import { postJson } from './api.js';
import { byId, el } from './dom.js';
import { icon } from './icons.js';

const MAX_TURNS = 12;

// Starter questions, tailored to the kind of event.
const SUGGESTIONS = {
  wedding: [
    'What should I book first?',
    'Is my budget realistic?',
    'How can I save on catering?',
    'Give me a rain-or-delay backup plan',
  ],
  birthday: [
    'What should I book first?',
    'Is my budget realistic?',
    'Fun games for the guest list?',
    'How can I save on decor?',
  ],
  community: [
    'How do I recruit volunteers?',
    'Is my budget realistic?',
    'How can I keep costs low?',
    'What permissions might I need?',
  ],
  public: [
    'What permits do I need?',
    'How do I plan crowd safety?',
    'How can I find sponsors?',
    'Is my budget realistic?',
  ],
};

const timeLabel = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const SPEAKER = { user: 'You', assistant: 'Assistant', error: 'Notice' };

const avatar = (role) =>
  el(
    'span',
    { className: `avatar avatar-${role}`, 'aria-hidden': 'true' },
    icon(role === 'user' ? 'user' : 'sparkles', { size: 16 }),
  );

/** The scrolling message list: bubbles, and the "assistant is typing" indicator. */
function createMessageLog(log) {
  let typingRow = null;
  const scrollToEnd = () => log.scrollTo({ top: log.scrollHeight });

  function add(role, text) {
    log.append(
      el(
        'div',
        { className: `msg-row msg-row-${role}` },
        avatar(role === 'user' ? 'user' : 'assistant'),
        el(
          'div',
          { className: 'msg-col' },
          el('div', { className: `msg msg-${role}`, text }),
          el('span', { className: 'msg-meta', text: `${SPEAKER[role]} · ${timeLabel()}` }),
        ),
      ),
    );
    scrollToEnd();
  }

  function showTyping() {
    typingRow = el(
      'div',
      { className: 'msg-row msg-row-assistant' },
      avatar('assistant'),
      el(
        'div',
        { className: 'msg msg-assistant typing' },
        el('span', { className: 'visually-hidden', text: 'The assistant is typing' }),
        el('i'),
        el('i'),
        el('i'),
      ),
    );
    log.append(typingRow);
    scrollToEnd();
  }

  function hideTyping() {
    typingRow?.remove();
    typingRow = null;
  }

  function clear() {
    hideTyping();
    log.replaceChildren();
  }

  return { add, showTyping, hideTyping, clear };
}

/** Clickable starter questions for the kind of event. */
function suggestionChips(eventType, onPick) {
  return (SUGGESTIONS[eventType] ?? SUGGESTIONS.wedding).map((question) => {
    const chip = el('button', { type: 'button', className: 'chip', text: question });
    chip.addEventListener('click', () => onPick(question));
    return chip;
  });
}

/**
 * Wires up the chat box. `getEvent()` returns the event details the plan was built from,
 * so the server can ground its answers (it re-validates and recomputes everything).
 */
export function setupChat({ getEvent, aiAvailable }) {
  const form = byId('chat-form');
  const input = byId('chat-input');
  const send = byId('chat-send');
  const note = byId('chat-note');
  const chips = byId('chat-suggestions');
  const messages = createMessageLog(byId('chat-log'));
  let history = [];
  let busy = false;
  let session = 0; // bumped for every new plan, so a late answer for the old plan is ignored

  function renderChips() {
    chips.replaceChildren();
    if (history.length > 0 || !aiAvailable()) return; // only before the first question
    chips.append(...suggestionChips(getEvent()?.eventType, (question) => ask(question)));
  }

  function setEnabled(enabled, message) {
    input.disabled = !enabled;
    send.disabled = !enabled;
    form.classList.toggle('is-disabled', !enabled);
    note.textContent = message;
  }

  /** Records the outcome of a question in the history and the message list. */
  function finishTurn({ role, text }) {
    messages.hideTyping();
    if (role === 'assistant') {
      history.push({ role: 'assistant', content: text });
      history = history.slice(-MAX_TURNS);
    } else {
      history.pop(); // drop the unanswered question so the next turn still ends with a user message
    }
    messages.add(role, text);
    busy = false;
    send.disabled = false;
    input.focus();
  }

  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;

    const mine = session;
    busy = true;
    send.disabled = true;
    input.value = '';
    history.push({ role: 'user', content: question });
    history = history.slice(-MAX_TURNS);
    chips.replaceChildren();
    messages.add('user', question);
    messages.showTyping();

    let outcome;
    try {
      const { reply } = await postJson('/api/chat', { event: getEvent(), messages: history });
      outcome = { role: 'assistant', text: reply };
    } catch (error) {
      outcome = { role: 'error', text: error.message };
    }

    // A new plan started while we waited: its conversation must not receive this answer.
    if (mine === session) finishTurn(outcome);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });

  /** Called whenever a new plan is created: starts a fresh conversation. */
  function reset() {
    session += 1;
    busy = false;
    history = [];
    messages.clear();
    if (aiAvailable()) {
      setEnabled(true, 'Ask about vendors, budgets, schedules or etiquette for this event.');
      messages.add(
        'assistant',
        'Hi! I have your plan open. Ask me anything about it, or pick a question below to get started.',
      );
    } else {
      setEnabled(false, 'The chat assistant is not available right now. Your plan above still works.');
    }
    renderChips();
  }

  return { reset };
}
