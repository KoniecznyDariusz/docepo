import { Routes } from '@angular/router';
import { CoursePanel } from './panel/course/course-panel';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { GroupPanel } from './panel/group/group-panel';
import { AttendancePanel } from 'app/panel/attendance/attendance-panel';
import { StudentPanel } from './panel/student/student-panel';
import { SolutionPanel } from './panel/solution/solution-panel';
import { MoodleSelectionPanel } from './panel/moodle-selection/moodle-selection-panel';
import { moodleSelectionGuard } from './guard/moodle-selection.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'course', pathMatch: 'full' },
    { path: 'moodle-selection', component: MoodleSelectionPanel, data: { backTo: '/' } },
    { path: 'course', component: CoursePanel, canActivate: [moodleSelectionGuard]},
    { path: 'groups/:courseId', component: GroupPanel, canActivate: [moodleSelectionGuard], data: { backTo: '/course' } },
    { path: 'attendance/:classDateId', component: AttendancePanel, canActivate: [moodleSelectionGuard] },
    { path: 'student/:studentId/:groupId', component: StudentPanel, canActivate: [moodleSelectionGuard] },
    { path: 'solution/:studentId/:taskId', component: SolutionPanel, canActivate: [moodleSelectionGuard] },
    {
        path: 'panel/group/:groupId',
        loadComponent: () => import('./panel/group/group-panel').then(m => m.GroupPanel),
        data: { backTo: '/panel/course' }
    },
    {
        path: 'panel/student/:studentId',
        loadComponent: () => import('./panel/student/student-panel').then(m => m.StudentPanel),
        data: { backTo: '/panel/group' }
    },
    {
        path: 'panel/moodle-selection',
        loadComponent: () => import('./panel/moodle-selection/moodle-selection-panel').then(m => m.MoodleSelectionPanel),
        data: { backTo: '/' }
    },
    {
        path: 'panel/course',
        loadComponent: () => import('./panel/course/course-panel').then(m => m.CoursePanel),
        data: { backTo: '/panel/moodle-selection' }
    },
    {
        path: 'panel/group/:courseId',
        loadComponent: () => import('./panel/group/group-panel').then(m => m.GroupPanel),
        data: { backTo: '/panel/course' }
    },
    {
        path: 'panel/student/:groupId',
        loadComponent: () => import('./panel/student/student-panel').then(m => m.StudentPanel),
        data: { backTo: '/panel/group' }
    },
    {
        path: 'panel/attendance/:classDateId',
        loadComponent: () => import('./panel/attendance/attendance-panel').then(m => m.AttendancePanel),
        data: { backTo: '/panel/student' }
    }
];
