import { Routes } from '@angular/router';
import { CoursePanel } from './panel/course/course-panel';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { GroupPanel } from './panel/group/group-panel';
import { AttendancePanel } from 'app/panel/attendance/attendance-panel';
import { StudentPanel } from './panel/student/student-panel';
import { MoodleSelectionPanel } from './panel/moodle-selection/moodle-selection-panel';
import { moodleSelectionGuard } from './guard/moodle-selection.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'main', pathMatch: 'full' },
    { path: 'moodle-selection', component: MoodleSelectionPanel },
    { path: 'main', component: CoursePanel, canActivate: [moodleSelectionGuard] },
    { path: 'groups', component: GroupPanel, canActivate: [moodleSelectionGuard] },
    { path: 'attendance', component: AttendancePanel, canActivate: [moodleSelectionGuard] },
    { path: 'student', component: StudentPanel, canActivate: [moodleSelectionGuard] },
];
