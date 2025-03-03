//
// Copyright © 2023 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import core, {
  type AttachedDoc,
  type Class,
  type Doc,
  type Ref,
  type TxCUD,
  type TxCollectionCUD,
  TxProcessor,
  toIdMap,
  SortingOrder,
  TxFactory,
  toFindResult,
  type TxCreateDoc
} from '@hcengineering/core'
import activity, { type DocUpdateMessage } from '@hcengineering/activity'
import { tryMigrate, type MigrateOperation, type MigrationClient, type MigrationIterator } from '@hcengineering/model'
import {
  type ActivityControl,
  type DocObjectCache,
  getAllObjectTransactions,
  serverActivityId
} from '@hcengineering/server-activity'
import { generateDocUpdateMessages } from '@hcengineering/server-activity-resources'
import { DOMAIN_ACTIVITY } from '@hcengineering/model-activity'

function getActivityControl (client: MigrationClient): ActivityControl {
  const txFactory = new TxFactory(core.account.System, false)

  return {
    txFactory,
    modelDb: client.model,
    hierarchy: client.hierarchy,
    findAll: async (_class, query, options) =>
      toFindResult(await client.find(client.hierarchy.getDomain(_class), query, options))
  }
}

async function generateDocUpdateMessageByTx (
  tx: TxCUD<Doc>,
  control: ActivityControl,
  client: MigrationClient,
  objectCache?: DocObjectCache
): Promise<void> {
  const existsMessages = await client.find<DocUpdateMessage>(
    DOMAIN_ACTIVITY,
    { _class: activity.class.DocUpdateMessage, txId: tx._id },
    { projection: { _id: 1 } }
  )

  if (existsMessages.length > 0) {
    return
  }

  const createCollectionCUDTxes = await generateDocUpdateMessages(tx, control, undefined, undefined, objectCache)

  for (const collectionTx of createCollectionCUDTxes) {
    const createTx = collectionTx.tx as TxCreateDoc<DocUpdateMessage>
    const domain = client.hierarchy.getDomain(createTx.objectClass)

    await client.create<DocUpdateMessage>(domain, {
      _id: createTx.objectId,
      _class: createTx.objectClass,
      space: createTx.objectSpace,
      modifiedOn: createTx.modifiedOn,
      modifiedBy: createTx.modifiedBy,
      createdOn: createTx.modifiedOn,
      createdBy: createTx.createdBy,
      ...createTx.attributes
    })
  }
}

async function createDocUpdateMessages (client: MigrationClient): Promise<void> {
  const activityDocs = await client.model.findAll(activity.mixin.ActivityDoc, {})
  const activityDocClasses = activityDocs
    .map(({ _id }) => _id)
    .filter((_class) => !client.hierarchy.isDerived(_class, activity.class.ActivityMessage))

  const notificationControl = getActivityControl(client)

  const txClient: Pick<ActivityControl, 'hierarchy' | 'findAll'> = {
    hierarchy: notificationControl.hierarchy,
    findAll: notificationControl.findAll
  }

  let processed = 0

  async function generateFor (_class: Ref<Class<Doc>>, documents: MigrationIterator<Doc>): Promise<void> {
    while (true) {
      const docs = await documents.next(50)

      if (docs == null || docs.length === 0) {
        break
      }
      const allTransactions = await getAllObjectTransactions(
        txClient,
        _class,
        docs.map((it) => it._id)
      )

      // We need to find parent collection objects if missing
      const byClass = new Map<Ref<Class<Doc>>, Set<Ref<Doc>>>()
      for (const vv of allTransactions.values()) {
        for (const v of vv) {
          try {
            const _cl = client.hierarchy.getBaseClass(v.objectClass)
            const s = byClass.get(_cl) ?? new Set()
            s.add(v.objectId)
            byClass.set(_cl, s)
          } catch {
            console.log('class not found:', v.objectClass)
            continue
          }

          if (v._class === core.class.TxCollectionCUD) {
            try {
              const vcol = v as TxCollectionCUD<Doc, AttachedDoc>
              const _cl = client.hierarchy.getBaseClass(vcol.tx.objectClass)
              const s = byClass.get(_cl) ?? new Set()
              s.add(vcol.tx.objectId)
              byClass.set(_cl, s)
            } catch {
              console.log('class not found:', (v as TxCollectionCUD<Doc, AttachedDoc>).tx.objectClass)
            }
          }
        }
      }

      const docIds: Map<Ref<Doc>, Doc | null> = toIdMap(docs)

      for (const [_class, classDocs] of byClass.entries()) {
        const ids: Ref<Doc>[] = Array.from(classDocs.values()).filter((it) => !docIds.has(it))
        if (ids.length > 0) {
          for (const di of ids) {
            docIds.set(di, null)
          }
          const edocs = await txClient.findAll(_class, { _id: { $in: ids } })
          for (const ed of edocs) {
            docIds.set(ed._id, ed)
          }
        }
      }

      for (const d of docs) {
        processed += 1
        if (processed % 1000 === 0) {
          console.log('processed', processed)
        }
        const transactions = allTransactions.get(d._id) ?? []
        for (const tx of transactions) {
          const innerTx = TxProcessor.extractTx(tx) as TxCUD<Doc>

          if (!client.hierarchy.hasClass(innerTx.objectClass)) {
            console.log('class not found:', innerTx.objectClass)
            continue
          }

          try {
            await generateDocUpdateMessageByTx(tx, notificationControl, client, {
              docs: docIds,
              transactions: allTransactions
            })
          } catch (e: any) {
            console.error('error processing:', d._id, e.stack)
          }
        }
      }
    }
    await documents.close()
  }

  for (const activityClass of activityDocClasses) {
    console.log('processing', activityClass)

    if (client.hierarchy.isMixin(activityClass)) {
      // Skip mixins
      continue
    }

    const domain = client.hierarchy.getDomain(activityClass)

    await generateFor(
      activityClass,
      await client.traverse<Doc>(
        domain,
        {
          _class: activityClass,
          space: { $ne: core.space.Model }
        },
        {
          sort: {
            createdOn: SortingOrder.Ascending
          }
        }
      )
    )
  }
  console.log('process-finished', processed)
}

export const activityServerOperation: MigrateOperation = {
  async migrate (client: MigrationClient): Promise<void> {
    await tryMigrate(client, serverActivityId, [
      {
        state: 'doc-update-messages',
        func: async (client) => {
          // Recreate activity to avoid duplicates
          await client.deleteMany(DOMAIN_ACTIVITY, {
            _class: activity.class.DocUpdateMessage
          })
          await createDocUpdateMessages(client)
        }
      }
    ])
  },
  async upgrade (): Promise<void> {}
}
