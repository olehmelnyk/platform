//
// Copyright © 2022-2023 Hardcore Engineering Inc.
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

import { Employee, Person } from '@hcengineering/contact'
import {
  AttachedDoc,
  Attribute,
  Class,
  CollectionSize,
  Data,
  Doc,
  DocManager,
  IdMap,
  Markup,
  Ref,
  RelatedDocument,
  Space,
  Status,
  Timestamp,
  Type,
  WithLookup
} from '@hcengineering/core'
import { Asset, IntlString, Plugin, Resource, plugin } from '@hcengineering/platform'
import { TagCategory, TagElement, TagReference } from '@hcengineering/tags'
import task, {
  ProjectTypeDescriptor,
  Task,
  Project as TaskProject,
  TaskStatusFactory,
  TaskType,
  TaskTypeDescriptor
} from '@hcengineering/task'
import { AnyComponent, ComponentExtensionId, Location, ResolvedLocation } from '@hcengineering/ui'
import { PaletteColorIndexes } from '@hcengineering/ui/src/colors'
import { Action, ActionCategory, IconProps } from '@hcengineering/view'

/**
 * @public
 */
export interface IssueStatus extends Status {}

/**
 * @public
 */
export interface Project extends TaskProject, IconProps {
  identifier: string // Project identifier
  sequence: number
  defaultIssueStatus: Ref<IssueStatus>
  defaultAssignee?: Ref<Employee>
  defaultTimeReportDay: TimeReportDayType
}

export type RelatedIssueKind = 'classRule' | 'spaceRule'

export interface RelatedClassRule {
  kind: 'classRule'
  ofClass: Ref<Class<Doc>>
}

export interface RelatedSpaceRule {
  kind: 'spaceRule'
  space: Ref<Space>
}

/**
 * @public
 *
 * If defined, will be used to set a default project for this kind of document's related issues.
 */
export interface RelatedIssueTarget extends Doc {
  // Attached to project.
  target?: Ref<Project> | null
  rule: RelatedClassRule | RelatedSpaceRule
}

/**
 * @public
 */
export enum TimeReportDayType {
  CurrentWorkDay = 'CurrentWorkDay',
  PreviousWorkDay = 'PreviousWorkDay'
}

/**
 * @public
 */
export enum IssuePriority {
  NoPriority,
  Urgent,
  High,
  Medium,
  Low
}

/**
 * @public
 */
export enum IssuesGrouping {
  Status = 'status',
  Assignee = 'assignee',
  Priority = 'priority',
  Component = 'component',
  Milestone = 'milestone',
  NoGrouping = '#no_category'
}

/**
 * @public
 */
export enum IssuesOrdering {
  Status = 'status',
  Priority = 'priority',
  LastUpdated = 'modifiedOn',
  DueDate = 'dueDate',
  Manual = 'rank'
}

/**
 * @public
 */
export enum IssuesDateModificationPeriod {
  All = 'all',
  PastWeek = 'pastWeek',
  PastMonth = 'pastMonth'
}

/**
 * @public
 */
export enum MilestoneStatus {
  Planned,
  InProgress,
  Completed,
  Canceled
}

/**
 * @public
 */
export interface Milestone extends Doc {
  label: string
  description?: Markup

  status: MilestoneStatus

  space: Ref<Project>

  comments: number
  attachments?: number

  targetDate: Timestamp
}

/**
 * @public
 */
export interface Issue extends Task {
  attachedTo: Ref<Issue>
  title: string
  description: Markup
  status: Ref<IssueStatus>
  priority: IssuePriority

  component: Ref<Component> | null

  // For subtasks
  subIssues: CollectionSize<Issue>
  blockedBy?: RelatedDocument[]
  relations?: RelatedDocument[]
  parents: IssueParentInfo[]

  space: Ref<Project>

  milestone?: Ref<Milestone> | null

  // Estimation in man hours
  estimation: number

  // Remaining time in man hours
  remainingTime: number

  // ReportedTime time, auto updated using trigger.
  reportedTime: number
  // Collection of reportedTime entries, for proper time estimations per person.
  reports: CollectionSize<TimeSpendReport>

  childInfo: IssueChildInfo[]

  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }
}

/**
 * @public
 */
export interface IssueDraft {
  kind?: Ref<TaskType>
  _id: Ref<Issue>
  title: string
  description: Markup
  status?: Ref<IssueStatus>
  priority: IssuePriority
  assignee: Ref<Person> | null
  component: Ref<Component> | null
  space: Ref<Project>
  dueDate: Timestamp | null
  milestone?: Ref<Milestone> | null

  // Estimation in man days
  estimation: number
  parentIssue?: Ref<Issue>
  attachments?: number
  labels: TagReference[]
  subIssues: IssueDraft[]
  template?: {
    // A template issue is based on
    template: Ref<IssueTemplate>
    // Child id in template
    childId?: string
  }
}

/**
 * @public
 */
export interface IssueTemplateData {
  title: string
  description: Markup
  priority: IssuePriority

  assignee: Ref<Person> | null
  component: Ref<Component> | null

  milestone?: Ref<Milestone> | null

  // Estimation in man days
  estimation: number

  labels?: Ref<TagElement>[]
}

/**
 * @public
 */
export interface IssueTemplateChild extends IssueTemplateData {
  id: Ref<Issue>
}

/**
 * @public
 */
export interface IssueTemplate extends Doc, IssueTemplateData {
  space: Ref<Project>

  children: IssueTemplateChild[]

  // Discussion stuff
  comments: number
  attachments?: number

  relations?: RelatedDocument[]
}

/**
 * @public
 *
 * Declares time spend entry
 */
export interface TimeSpendReport extends AttachedDoc {
  attachedTo: Ref<Issue>

  employee: Ref<Employee> | null

  date: Timestamp | null
  // Value in man hours
  value: number

  description: string
}

/**
 * @public
 */
export interface IssueParentInfo {
  parentId: Ref<Issue>
  parentTitle: string
  space: Ref<Space>
}

/**
 * @public
 */
export interface IssueChildInfo {
  childId: Ref<Issue>
  estimation: number
  reportedTime: number
}

/**
 * @public
 */
export interface Document extends Doc {
  title: string
  icon: string | null
  color: number
  content?: Markup

  space: Ref<Project>
}

/**
 * @public
 */
export interface Component extends Doc {
  label: string
  description?: Markup
  lead: Ref<Employee> | null
  space: Ref<Project>
  comments: number
  attachments?: number
}

/**
 * @public
 *
 * Allow to query for status keys/values.
 */
export class ComponentManager extends DocManager {
  get (ref: Ref<WithLookup<Component>>): WithLookup<Component> | undefined {
    return this.getIdMap().get(ref) as WithLookup<Component>
  }

  getDocs (): Array<WithLookup<Component>> {
    return this.docs as Component[]
  }

  getIdMap (): IdMap<WithLookup<Component>> {
    return this.byId as IdMap<WithLookup<Component>>
  }

  filter (predicate: (value: Component) => boolean): Component[] {
    return this.getDocs().filter(predicate)
  }
}

/**
 * @public
 */
export const classicIssueTaskStatuses: TaskStatusFactory[] = [
  { category: task.statusCategory.UnStarted, statuses: [['Backlog', PaletteColorIndexes.Cloud]] },
  { category: task.statusCategory.ToDo, statuses: [['Todo', PaletteColorIndexes.Porpoise]] },
  {
    category: task.statusCategory.Active,
    statuses: [['In progress', PaletteColorIndexes.Cerulean]]
  },
  { category: task.statusCategory.Won, statuses: [['Done', PaletteColorIndexes.Grass]] },
  { category: task.statusCategory.Lost, statuses: [['Canceled', PaletteColorIndexes.Coin]] }
]

/**
 * @public
 */
export const baseIssueTaskStatuses: TaskStatusFactory[] = [
  { category: task.statusCategory.UnStarted, statuses: [['Backlog', PaletteColorIndexes.Cloud]] },
  {
    category: task.statusCategory.Active,
    statuses: [
      ['Coding', PaletteColorIndexes.Porpoise],
      ['Under review', PaletteColorIndexes.Cerulean]
    ]
  },
  { category: task.statusCategory.Won, statuses: [['Done', PaletteColorIndexes.Grass]] },
  { category: task.statusCategory.Lost, statuses: [['Canceled', PaletteColorIndexes.Coin]] }
]

/**
 * @public
 */
export const trackerId = 'tracker' as Plugin

const pluginState = plugin(trackerId, {
  class: {
    Project: '' as Ref<Class<Project>>,
    Issue: '' as Ref<Class<Issue>>,
    IssueTemplate: '' as Ref<Class<IssueTemplate>>,
    Component: '' as Ref<Class<Component>>,
    IssueStatus: '' as Ref<Class<IssueStatus>>,
    TypeIssuePriority: '' as Ref<Class<Type<IssuePriority>>>,
    Milestone: '' as Ref<Class<Milestone>>,
    TypeMilestoneStatus: '' as Ref<Class<Type<MilestoneStatus>>>,
    TimeSpendReport: '' as Ref<Class<TimeSpendReport>>,
    TypeReportedTime: '' as Ref<Class<Type<number>>>,
    TypeEstimation: '' as Ref<Class<Type<number>>>,
    TypeRemainingTime: '' as Ref<Class<Type<number>>>,
    RelatedIssueTarget: '' as Ref<Class<RelatedIssueTarget>>
  },
  ids: {
    NoParent: '' as Ref<Issue>,
    IssueDraft: '',
    IssueDraftChild: ''
  },
  component: {
    Tracker: '' as AnyComponent,
    TrackerApp: '' as AnyComponent,
    RelatedIssues: '' as AnyComponent,
    RelatedIssuesSection: '' as AnyComponent,
    RelatedIssueSelector: '' as AnyComponent,
    RelatedIssueTemplates: '' as AnyComponent,
    EditIssue: '' as AnyComponent,
    CreateIssue: '' as AnyComponent,
    ProjectPresenter: '' as AnyComponent,
    CreateIssueTemplate: '' as AnyComponent
  },
  attribute: {
    IssueStatus: '' as Ref<Attribute<Status>>
  },
  icon: {
    TrackerApplication: '' as Asset,
    Component: '' as Asset,
    Issue: '' as Asset,
    Subissue: '' as Asset,
    Project: '' as Asset,
    Relations: '' as Asset,
    Inbox: '' as Asset,
    MyIssues: '' as Asset,
    Views: '' as Asset,
    Issues: '' as Asset,
    Components: '' as Asset,
    NewIssue: '' as Asset,
    Magnifier: '' as Asset,
    Labels: '' as Asset,
    DueDate: '' as Asset,
    Parent: '' as Asset,
    Milestone: '' as Asset,
    IssueTemplates: '' as Asset,
    Start: '' as Asset,
    Stop: '' as Asset,

    CategoryBacklog: '' as Asset,
    CategoryUnstarted: '' as Asset,
    CategoryStarted: '' as Asset,
    CategoryCompleted: '' as Asset,
    CategoryCanceled: '' as Asset,

    PriorityNoPriority: '' as Asset,
    PriorityUrgent: '' as Asset,
    PriorityHigh: '' as Asset,
    PriorityMedium: '' as Asset,
    PriorityLow: '' as Asset,

    ComponentsList: '' as Asset,

    MilestoneStatusPlanned: '' as Asset,
    MilestoneStatusInProgress: '' as Asset,
    MilestoneStatusPaused: '' as Asset,
    MilestoneStatusCompleted: '' as Asset,
    MilestoneStatusCanceled: '' as Asset,

    CopyBranch: '' as Asset,
    Duplicate: '' as Asset,

    TimeReport: '' as Asset,
    Estimation: '' as Asset,

    // Project icons
    Home: '' as Asset,
    RedCircle: '' as Asset
  },
  category: {
    Other: '' as Ref<TagCategory>,
    Tracker: '' as Ref<ActionCategory>
  },
  descriptors: {
    ProjectType: '' as Ref<ProjectTypeDescriptor>,
    Issue: '' as Ref<TaskTypeDescriptor>
  },
  action: {
    SetDueDate: '' as Ref<Action<Doc, any>>,
    SetParent: '' as Ref<Action<Doc, any>>,
    SetStatus: '' as Ref<Action>,
    SetPriority: '' as Ref<Action<Doc, any>>,
    SetAssignee: '' as Ref<Action<Doc, any>>,
    SetComponent: '' as Ref<Action<Doc, any>>,
    CopyIssueId: '' as Ref<Action<Doc, any>>,
    CopyIssueTitle: '' as Ref<Action<Doc, any>>,
    CopyIssueLink: '' as Ref<Action<Doc, any>>,
    MoveToProject: '' as Ref<Action>,
    Duplicate: '' as Ref<Action<Doc, any>>,
    Relations: '' as Ref<Action<Doc, any>>,
    NewIssue: '' as Ref<Action<Doc, any>>,
    NewIssueGlobal: '' as Ref<Action<Doc, any>>,
    NewSubIssue: '' as Ref<Action<Doc, any>>,
    EditWorkflowStatuses: '' as Ref<Action>,
    EditProject: '' as Ref<Action>,
    SetMilestone: '' as Ref<Action<Doc, any>>,
    SetLabels: '' as Ref<Action<Doc, any>>,
    EditRelatedTargets: '' as Ref<Action<Doc, any>>
  },
  project: {
    DefaultProject: '' as Ref<Project>
  },
  resolver: {
    Location: '' as Resource<(loc: Location) => Promise<ResolvedLocation | undefined>>
  },
  string: {
    ConfigLabel: '' as IntlString,
    NewRelatedIssue: '' as IntlString,
    IssueNotificationTitle: '' as IntlString,
    IssueNotificationBody: '' as IntlString,
    IssueNotificationChanged: '' as IntlString,
    IssueNotificationChangedProperty: '' as IntlString,
    IssueNotificationMessage: '' as IntlString,
    IssueAssigneedToYou: '' as IntlString,
    Project: '' as IntlString,
    RelatedIssues: '' as IntlString
  },
  extensions: {
    IssueListHeader: '' as ComponentExtensionId,
    EditIssueHeader: '' as ComponentExtensionId,
    EditIssueTitle: '' as ComponentExtensionId
  },
  taskTypes: {
    Issue: '' as Ref<TaskType>,
    SubIssue: '' as Ref<TaskType>
  }
})
export default pluginState

/**
 * @public
 */
export function createStatesData (data: TaskStatusFactory[]): Omit<Data<Status>, 'rank'>[] {
  const states: Omit<Data<Status>, 'rank'>[] = []

  for (const category of data) {
    for (const sName of category.statuses) {
      states.push({
        ofAttribute: pluginState.attribute.IssueStatus,
        name: Array.isArray(sName) ? sName[0] : sName,
        color: Array.isArray(sName) ? sName[1] : undefined,
        category: category.category
      })
    }
  }
  return states
}
