import type {ModelTask} from './models.ts';

// Explicit application actions, not LLM intent detection. LangGraph comes in Phase 4.
export function taskForAction(action:'chat'|'rewrite'|'continue'|'brainstorm'|'ask'|'analyze'):ModelTask {
  switch(action) {
    case 'chat': case 'ask': return 'qa';
    case 'analyze': return 'memory';
    case 'brainstorm': return 'planner';
    case 'rewrite': case 'continue': return 'writer';
  }
}
