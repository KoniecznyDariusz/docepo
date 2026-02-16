import { Routes } from '@angular/router';
import { StudentListComponent } from './component/attendance/student-list.component';

export const routes: Routes = [
    { path: '', redirectTo: 'attendance', pathMatch: 'full' },
    { path: 'attendance', component: StudentListComponent },
];
