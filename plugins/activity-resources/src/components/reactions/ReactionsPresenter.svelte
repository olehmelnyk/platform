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
  import { createQuery, getClient } from '@hcengineering/presentation'
  import activity, { ActivityMessage, Reaction } from '@hcengineering/activity'

  import Reactions from './Reactions.svelte'
  import { updateDocReactions } from '../../utils'

  export let object: ActivityMessage | undefined

  const client = getClient()
  const reactionsQuery = createQuery()

  let reactions: Reaction[] = []

  $: if (object) {
    reactionsQuery.query(activity.class.Reaction, { attachedTo: object._id }, (res?: Reaction[]) => {
      reactions = res || []
    })
  }

  const handleClick = (ev: CustomEvent) => {
    updateDocReactions(client, reactions, object, ev.detail)
  }
</script>

{#if object !== undefined && reactions.length > 0}
  <div class="footer flex-col p-inline contrast mt-2">
    <Reactions {reactions} {object} on:click={handleClick} />
  </div>
{/if}
