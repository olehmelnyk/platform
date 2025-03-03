<!--
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
-->
<script lang="ts">
  import activity, {
    ActivityMessage,
    DisplayActivityMessage,
    DisplayDocUpdateMessage,
    DocUpdateMessage,
    DocUpdateMessageViewlet
  } from '@hcengineering/activity'
  import { Person, PersonAccount } from '@hcengineering/contact'
  import { personByIdStore } from '@hcengineering/contact-resources'
  import core, { Account, AttachedDoc, Class, Collection, Doc, Ref } from '@hcengineering/core'
  import { IntlString } from '@hcengineering/platform'
  import { createQuery, getClient } from '@hcengineering/presentation'
  import { Component, ShowMore, Action } from '@hcengineering/ui'
  import { AttributeModel } from '@hcengineering/view'

  import ActivityMessageTemplate from '../activity-message/ActivityMessageTemplate.svelte'
  import DocUpdateMessageAttributes from './DocUpdateMessageAttributes.svelte'
  import DocUpdateMessageContent from './DocUpdateMessageContent.svelte'
  import DocUpdateMessageHeader from './DocUpdateMessageHeader.svelte'

  import { getAttributeModel, getCollectionAttribute } from '../../activityMessagesUtils'
  import { buildRemovedDoc, checkIsObjectRemoved } from '@hcengineering/view-resources'

  export let value: DisplayDocUpdateMessage
  export let showNotify: boolean = false
  export let isHighlighted: boolean = false
  export let isSelected: boolean = false
  export let shouldScroll: boolean = false
  export let embedded: boolean = false
  export let withActions: boolean = true
  export let showEmbedded = false
  export let hideReplies = false
  export let actions: Action[] = []
  export let onClick: (() => void) | undefined = undefined
  export let onReply: (() => void) | undefined = undefined

  const client = getClient()
  const hierarchy = client.getHierarchy()

  const userQuery = createQuery()
  const objectQuery = createQuery()
  const parentObjectQuery = createQuery()

  const collectionAttribute = getCollectionAttribute(hierarchy, value.attachedToClass, value.updateCollection)
  const clazz = hierarchy.getClass(value.objectClass)
  const objectName: IntlString | undefined =
    (collectionAttribute?.type as Collection<AttachedDoc>)?.itemLabel || clazz.label
  const collectionName = collectionAttribute?.label

  let user: PersonAccount | undefined = undefined
  let person: Person | undefined = undefined
  let viewlet: DocUpdateMessageViewlet | undefined
  let attributeModel: AttributeModel | undefined = undefined
  let parentMessage: DisplayActivityMessage | undefined = undefined
  let parentObject: Doc | undefined
  let object: Doc | undefined
  let isObjectRemoved: boolean = false

  let isObjectLoading = true

  $: isLoading = isObjectLoading

  $: [viewlet] = client
    .getModel()
    .findAllSync(activity.class.DocUpdateMessageViewlet, { action: value.action, objectClass: value.objectClass })

  $: void getAttributeModel(client, value.attributeUpdates, value.attachedToClass).then((model) => {
    attributeModel = model
  })

  async function getParentMessage (_class: Ref<Class<Doc>>, _id: Ref<Doc>): Promise<ActivityMessage | undefined> {
    if (hierarchy.isDerived(_class, activity.class.ActivityMessage)) {
      return await client.findOne(activity.class.ActivityMessage, { _id: _id as Ref<ActivityMessage> })
    }
  }

  $: void getParentMessage(value.attachedToClass, value.attachedTo).then((res) => {
    parentMessage = res as DisplayActivityMessage
  })

  $: userQuery.query(core.class.Account, { _id: value.createdBy }, (res: Account[]) => {
    user = res[0] as PersonAccount
  })

  $: person = user?.person != null ? $personByIdStore.get(user.person) : undefined

  $: void loadObject(value.objectId, value.objectClass)
  $: void loadParentObject(value, parentMessage)

  async function loadObject (_id: Ref<Doc>, _class: Ref<Class<Doc>>): Promise<void> {
    isObjectRemoved = await checkIsObjectRemoved(client, _id, _class)

    if (isObjectRemoved) {
      object = await buildRemovedDoc(client, _id, _class)
      isObjectLoading = false
    } else {
      objectQuery.query(_class, { _id }, (res) => {
        isObjectLoading = false
        object = res[0]
      })
    }
  }

  async function loadParentObject (message: DocUpdateMessage, parentMessage?: ActivityMessage): Promise<void> {
    if (!parentMessage && message.objectId === message.attachedTo) {
      return
    }

    const _id = parentMessage ? parentMessage.attachedTo : message.attachedTo
    const _class = parentMessage ? parentMessage.attachedToClass : message.attachedToClass
    const isRemoved = await checkIsObjectRemoved(client, _id, _class)

    if (isRemoved) {
      parentObject = await buildRemovedDoc(client, _id, _class)
      return
    }

    parentObjectQuery.query(_class, { _id }, (res) => {
      parentObject = res[0]
    })
  }

  $: if (object != null && value.objectClass !== object._class) {
    object = undefined
  }
</script>

{#if !isLoading && (!(viewlet?.hideIfRemoved ?? false) || !isObjectRemoved) && (value.action !== 'update' || attributeModel !== undefined)}
  <ActivityMessageTemplate
    message={value}
    {parentMessage}
    {person}
    {showNotify}
    {isHighlighted}
    {isSelected}
    {shouldScroll}
    {embedded}
    {withActions}
    {viewlet}
    {showEmbedded}
    {hideReplies}
    {actions}
    {onClick}
    {onReply}
  >
    <svelte:fragment slot="header">
      {#if viewlet?.labelComponent}
        <Component is={viewlet.labelComponent} props={{ value: object }} />
      {:else}
        <DocUpdateMessageHeader
          message={value}
          {object}
          {parentObject}
          {viewlet}
          {person}
          {objectName}
          {collectionName}
          {attributeModel}
        />
      {/if}
    </svelte:fragment>
    <svelte:fragment slot="content">
      {#if viewlet?.component}
        <ShowMore>
          <div class="customContent">
            {#each value?.previousMessages ?? [] as msg}
              <Component is={viewlet.component} props={{ message: msg, _id: msg.objectId, _class: msg.objectClass }} />
            {/each}
            <Component
              is={viewlet.component}
              props={{ message: value, _id: value.objectId, _class: value.objectClass, value: object }}
            />
          </div>
        </ShowMore>
      {:else if value.action === 'create' || value.action === 'remove'}
        <ShowMore>
          <DocUpdateMessageContent
            objectClass={value.objectClass}
            message={value}
            {viewlet}
            {objectName}
            {collectionName}
            {collectionAttribute}
          />
        </ShowMore>
      {:else if value.attributeUpdates && attributeModel}
        <DocUpdateMessageAttributes attributeUpdates={value.attributeUpdates} {attributeModel} {viewlet} />
      {/if}
    </svelte:fragment>
  </ActivityMessageTemplate>
{/if}

<style lang="scss">
  .customContent {
    display: flex;
    flex-wrap: wrap;
    column-gap: 0.625rem;
    row-gap: 0.625rem;
  }
</style>
