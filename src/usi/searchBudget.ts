export interface SearchBudget { kind: 'time' | 'depth' | 'nodes'; value: number }

export function validSearchBudget(budget: SearchBudget): boolean {
  return !!budget && ['time', 'depth', 'nodes'].includes(budget.kind)
    && (budget.kind === 'time' ? Number.isFinite(budget.value) : Number.isSafeInteger(budget.value)) && budget.value >= 1
    && budget.value <= (budget.kind === 'time' ? 60 : budget.kind === 'depth' ? 100 : 1_000_000_000);
}
export function searchBudgetCommand(budget: SearchBudget): string {
  return budget.kind === 'time' ? `go movetime ${Math.round(budget.value * 1000)}` : `go ${budget.kind} ${budget.value}`;
}
export function searchBudgetLabel(budget: SearchBudget): string {
  return budget.kind === 'time' ? `${budget.value} seconds` : budget.kind === 'depth' ? `depth ${budget.value}` : `${budget.value.toLocaleString()} nodes`;
}
