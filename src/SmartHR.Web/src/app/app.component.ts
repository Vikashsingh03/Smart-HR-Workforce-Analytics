import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

import { GlobalSearchComponent } from './shared/search/global-search.component';
import { ToastStackComponent } from './shared/ui/toast-stack.component';

const PAGE_TITLES: Record<string, string> = {
  '': 'Dashboard',
  employees: 'Employees',
  ai: 'AI Assistant',
  insights: 'Insights',
  reports: 'Reports',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, DatePipe, GlobalSearchComponent, ToastStackComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  pageTitle = 'Dashboard';
  lastUpdated = new Date();
  sidebarOpen = false;

  private routerSub: Subscription | null = null;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.updateTitle();
    this.routerSub = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updateTitle();
        this.lastUpdated = new Date();
        this.sidebarOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.routerSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }

  closeSidebar(): void {
    this.sidebarOpen = false;
  }

  refresh(): void {
    this.lastUpdated = new Date();
    void this.router.navigateByUrl(this.router.url, { onSameUrlNavigation: 'reload' });
  }

  private updateTitle(): void {
    const segment = this.router.url.split('?')[0].replace(/^\//, '').split('/')[0];
    this.pageTitle = PAGE_TITLES[segment] ?? 'Dashboard';
  }
}
