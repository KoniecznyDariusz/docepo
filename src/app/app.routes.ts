import { Routes } from '@angular/router';
import { CoursePanel } from './panel/course/course-panel';
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
    { path: 'solution/:studentId/:taskId', component: SolutionPanel, canActivate: [moodleSelectionGuard] }
];
