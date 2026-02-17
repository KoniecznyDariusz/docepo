import { Routes } from '@angular/router';
import { MainPanel } from './panel/main/main-panel';
import { GroupListComponent } from 'app/component/group-list/group-list.component';
import { AttendancePanel } from 'app/panel/attendance/attendance-panel';

export const routes: Routes = [
    { path: '', redirectTo: 'main', pathMatch: 'full' },
    { path: 'main', component: MainPanel },
    { path: 'groups', component: GroupListComponent },
    { path: 'attendance', component: AttendancePanel },
];
