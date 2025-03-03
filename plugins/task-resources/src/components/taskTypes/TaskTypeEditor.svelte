<!--
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021, 2022, 2023 Hardcore Engineering Inc.
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
  import { AttributeEditor, getClient } from '@hcengineering/presentation'
  import task, { ProjectType, TaskType, calculateStatuses } from '@hcengineering/task'
  import { Ref, Status } from '@hcengineering/core'
  import { Asset, getEmbeddedLabel } from '@hcengineering/platform'
  import { Label, showPopup } from '@hcengineering/ui'
  import { IconPicker, statusStore } from '@hcengineering/view-resources'
  import { ClassAttributes } from '@hcengineering/setting-resources'
  import { taskTypeStore } from '../..'
  import StatesProjectEditor from '../state/StatesProjectEditor.svelte'
  import TaskTypeKindEditor from '../taskTypes/TaskTypeKindEditor.svelte'
  import TaskTypeRefEditor from '../taskTypes/TaskTypeRefEditor.svelte'
  import TaskTypeIcon from './TaskTypeIcon.svelte'

  export let projectType: ProjectType
  export let taskType: TaskType
  export let taskTypeCounter: Map<Ref<TaskType>, number>
  export let taskTypes: TaskType[]

  const client = getClient()

  $: descriptor = client.getModel().findAllSync(task.class.TaskTypeDescriptor, { _id: taskType?.descriptor })

  $: states = taskType.statuses.map((p) => $statusStore.byId.get(p)).filter((p) => p !== undefined) as Status[]

  function selectIcon (el: MouseEvent): void {
    const icons: Asset[] = [descriptor[0].icon]
    showPopup(
      IconPicker,
      { icon: taskType?.icon, color: taskType?.color, icons, showColor: false },
      el.target as HTMLElement,
      async (result) => {
        if (result !== undefined && result !== null) {
          await client.update(taskType, { color: result.color, icon: result.icon })
        }
      }
    )
  }
</script>

<div class="flex-col">
  <div class="flex-row-center flex-between">
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <div class="mb-1" on:click={selectIcon}>
      <TaskTypeIcon value={taskType} size={'large'} />
    </div>
    <div class="ml-2 flex-row-center">
      {taskTypeCounter.get(taskType._id) ?? 0}
    </div>
  </div>
  <div class="flex-row-center">
    <div class="fs-title mb-4">
      <AttributeEditor
        maxWidth={'10rem'}
        _class={task.class.TaskType}
        object={taskType}
        key="name"
        editKind={'large-style'}
      />
    </div>
  </div>

  <TaskTypeKindEditor
    kind={taskType.kind}
    on:change={(evt) => {
      void client.diffUpdate(taskType, { kind: evt.detail })
    }}
  />

  <div class="flex-row-center p-2 mt-4">
    <div class="flex-no-shrink trans-title uppercase">
      <Label label={getEmbeddedLabel('Parent type restrictions')} />
    </div>
    {#if taskType.kind === 'subtask' || taskType.kind === 'both'}
      <TaskTypeRefEditor
        label={getEmbeddedLabel('Allowed parents')}
        value={taskType.allowedAsChildOf}
        types={taskTypes.filter((it) => it.kind === 'task' || it.kind === 'both')}
        onChange={(evt) => {
          void client.diffUpdate(taskType, { allowedAsChildOf: evt })
        }}
      />
    {/if}
  </div>
</div>
<div class="panelBox">
  <div class="p-2 trans-title">
    <Label label={getEmbeddedLabel('Process')} />
  </div>
  <div class="ml-2">
    <StatesProjectEditor
      {taskType}
      type={projectType}
      {states}
      on:delete={async (evt) => {
        const index = taskType.statuses.findIndex((p) => p === evt.detail.state._id)
        taskType.statuses.splice(index, 1)
        await client.update(taskType, {
          statuses: taskType.statuses
        })
        await client.update(projectType, {
          statuses: calculateStatuses(projectType, $taskTypeStore, [
            { taskTypeId: taskType._id, statuses: taskType.statuses }
          ])
        })
      }}
      on:move={async (evt) => {
        const index = taskType.statuses.findIndex((p) => p === evt.detail.stateID)
        const state = taskType.statuses.splice(index, 1)[0]

        const statuses = [
          ...taskType.statuses.slice(0, evt.detail.position),
          state,
          ...taskType.statuses.slice(evt.detail.position)
        ]
        await client.update(taskType, {
          statuses
        })

        await client.update(projectType, {
          statuses: calculateStatuses(projectType, $taskTypeStore, [{ taskTypeId: taskType._id, statuses }])
        })
      }}
    />
  </div>
</div>

<ClassAttributes ofClass={taskType.ofClass} _class={taskType.targetClass} showHierarchy />

<style lang="scss">
  .row {
    // border-bottom: 1px solid var(--theme-list-border-color);
    // border-top: 1px solid var(--theme-list-border-color);
    width: 100%;
  }
  .projects {
    padding: 0.5rem 1rem 0.5rem 0.25rem;
    color: var(--theme-caption-color);
    background-color: var(--theme-button-default);
    border: 1px solid var(--theme-button-border);
    border-radius: 0.5rem;
    user-select: none;
  }
  .panelBox {
    padding: 0.5rem;
    // TODO: Need to update it
    border: 1px solid var(--theme-button-border);
    background: var(--theme-button-default);
    border-radius: 8px;
  }
</style>
