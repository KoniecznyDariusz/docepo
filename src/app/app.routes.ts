import { Routes } from '@angular/router';
import { MainPanel } from './panel/main/main-panel';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { AttendancePanel } from 'app/panel/attendance/attendance-panel';
import { MoodleSelectionPanel } from './panel/moodle-selection/moodle-selection-panel';
import { moodleSelectionGuard } from './guard/moodle-selection.guard';

export const routes: Routes = [
    { path: '', redirectTo: 'main', pathMatch: 'full' },
    { path: 'moodle-selection', component: MoodleSelectionPanel },
    { path: 'main', component: MainPanel, canActivate: [moodleSelectionGuard] },
    { path: 'groups', component: GroupListComponent, canActivate: [moodleSelectionGuard] },
    { path: 'attendance', component: AttendancePanel, canActivate: [moodleSelectionGuard] },
];
