import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/api.service';
import { NlToSqlResult } from '../../core/models';

interface ConversationEntry {
  id: number;
  question: string;
  pending: boolean;
  result: NlToSqlResult | null;
  error: string | null;
  copied: boolean;
}

@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.component.html',
  styleUrls: ['./ai-assistant.component.css']
})
export class AiAssistantComponent {
  question = '';
  loading = false;
  entries: ConversationEntry[] = [];
  private nextId = 1;

  @ViewChild('questionBox') private questionBox?: ElementRef<HTMLTextAreaElement>;

  readonly exampleQuestions: string[] = [
    'Attrition rate by department?',
    'Does overtime go along with attrition?',
    'Which job roles lose people fastest?',
    'Is early tenure the riskiest period?',
    'Does income level matter?',
    'Where should HR act first?'
  ];

  constructor(private api: ApiService) {}

  get canAsk(): boolean {
    return !this.loading && this.question.trim().length > 0;
  }

  ask(): void {
    const q = this.question.trim();
    if (!q || this.loading) {
      return;
    }
    const entry: ConversationEntry = {
      id: this.nextId++,
      question: q,
      pending: true,
      result: null,
      error: null,
      copied: false
    };
    this.entries.push(entry);
    this.question = '';
    this.loading = true;
    this.scrollToBottom();
    this.api.askAi({ question: q }).subscribe({
      next: (res) => {
        entry.result = res;
        entry.pending = false;
        this.loading = false;
        this.scrollToBottom();
        this.focusQuestion();
      },
      error: () => {
        entry.error = 'The question could not be answered. Check that the API is running and try again.';
        entry.pending = false;
        this.loading = false;
        this.scrollToBottom();
      }
    });
  }

  useExample(q: string): void {
    this.question = q;
    this.ask();
  }

  clearHistory(): void {
    this.entries = [];
  }

  sourceLabel(entry: ConversationEntry): string {
    return entry.result?.source === 'gemini' ? 'AI generated' : 'Built-in question';
  }

  displayedRows(entry: ConversationEntry): Record<string, unknown>[] {
    return (entry.result?.rows ?? []).slice(0, 50);
  }

  rowCountNote(entry: ConversationEntry): string {
    if (!entry.result) {
      return '';
    }
    const total = entry.result.rows.length;
    if (total === 0) {
      return 'No rows returned.';
    }
    if (total >= 50) {
      return 'Showing the first 50 rows.';
    }
    return total === 1 ? '1 row.' : `${total} rows.`;
  }

  isColumnNumeric(entry: ConversationEntry, col: string): boolean {
    const first = this.displayedRows(entry)[0];
    return first ? this.isNumeric(first[col]) : false;
  }

  isNumeric(value: unknown): boolean {
    return typeof value === 'number' && Number.isFinite(value);
  }

  formatCell(value: unknown): string {
    if (value === null || value === undefined) {
      return '—';
    }
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        return value.toLocaleString('en-US');
      }
      const rounded = Math.round(value * 100) / 100;
      return rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return String(value);
  }

  async copySql(entry: ConversationEntry): Promise<void> {
    const sql = entry.result?.sql ?? '';
    if (!sql) {
      return;
    }
    try {
      await navigator.clipboard.writeText(sql);
      this.showCopied(entry);
    } catch {
      // Fallback for browsers without clipboard permission.
      const ta = document.createElement('textarea');
      ta.value = sql;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        this.showCopied(entry);
      } catch {
        // Copy failed; the SQL remains selectable in the code block.
      }
      document.body.removeChild(ta);
    }
  }

  trackById(_index: number, entry: ConversationEntry): number {
    return entry.id;
  }

  private showCopied(entry: ConversationEntry): void {
    entry.copied = true;
    window.setTimeout(() => {
      entry.copied = false;
    }, 2000);
  }

  private scrollToBottom(): void {
    window.setTimeout(() => window.scrollTo(0, document.body.scrollHeight), 0);
  }

  private focusQuestion(): void {
    this.questionBox?.nativeElement.focus();
  }
}
