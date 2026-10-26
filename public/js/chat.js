import { postJson } from './api.js';
import { byId, el } from './dom.js';
import { icon } from './icons.js';

const MAX_TURNS = 12;

// Starter questions, tailored to the kind of event.
const SUGGESTIONS = {
  wedding: ['What should I book first?', 'Is my budget realistic?', 'How can I save on catering?', 'Give me a rain-or-delay backup plan'],
  birthday: ['What should I book first?', 'Is my budget realistic?', 'Fun games for the guest list?', 'How can I save on decor?'],
  community: ['How do I recruit volunteers?', 'Is my budget realistic?', 'How can I keep costs low?', 'What permissions might I need?'],
  public: ['What permits do I need?', 'How do I plan crowd safety?', 'How can I find sponsors?', 'Is my budget realistic?'],
};

const timeLabel = () => new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

/**
 * Wires up the chat box. `getEvent()` returns the event details the plan was built from,
 * so the server can ground its answers (it re-validates and recomputes everything).
 */
export function setupChat({ getEvent, aiAvailable }) {
  const form = byId('chat-form');
  const input = byId('chat-input');
  const send = byId('chat-send');
  const log = byId('chat-log');
  const note = byId('chat-note');
  const chips = byId('chat-suggestions');
  let history = [];
  let busy = false;
  let typingRow = null;

  /* ---------- rendering ---------- */
  const avatar = (role) => el('span', { className: `avatar avatar-${role}`, 'aria-hidden': 'true' }, icon(role === 'user' ? 'user' : 'sparkles', { size: 16 }));

  function addMessage(role, text) {
    const who = role === 'user' ? 'You' : role === 'error' ? 'Notice' : 'Assistant';
    log.append(
      el(
        'div',
        { className: `msg-row msg-row-${role}` },
        avatar(role === 'user' ? 'user' : 'assistant'),
        el(
          'div',
          { className: 'msg-col' },
          el('div', { className: `msg msg-${role}`, text }),
          el('span', { className: 'msg-meta', text: `${who} · ${timeLabel()}` }),
        ),
      ),
    );
    log.scrollTo({ top: log.scrollHeight });
  }

  function showTyping() {
    typingRow = el(
      'div',
      { className: 'msg-row msg-row-assistant' },
      avatar('assistant'),
      el('div', { className: 'msg msg-assistant typing' }, el('span', { className: 'visually-hidden', text: 'The assistant is typing' }), el('i'), el('i'), el('i')),
    );
    log.append(typingRow);
    log.scrollTo({ top: log.scrollHeight });
  }
  const hideTyping = () => {
    typingRow?.remove();
    typingRow = null;
  };

  function renderChips() {
    chips.replaceChildren();
    if (history.length > 0 || !aiAvailable()) return; // only before the first question
    const type = getEvent()?.eventType;
    for (const question of SUGGESTIONS[type] ?? SUGGESTIONS.wedding) {
      const chip = el('button', { type: 'button', className: 'chip', text: question });
      chip.addEventListener('click', () => ask(question));
      chips.append(chip);
    }
  }

  function setEnabled(enabled, message) {
    input.disabled = !enabled;
    send.disabled = !enabled;
    form.classList.toggle('is-disabled', !enabled);
    if (message) note.textContent = message;
  }

  /* ---------- asking ---------- */
  async function ask(text) {
    const question = text.trim();
    if (!question || busy) return;

    busy = true;
    send.disabled = true;
    input.value = '';
    history.push({ role: 'user', content: question });
    history = history.slice(-MAX_TURNS);
    chips.replaceChildren();
    addMessage('user', question);
    showTyping();

    try {
      const { reply } = await postJson('/api/chat', { event: getEvent(), messages: history });
      hideTyping();
      history.push({ role: 'assistant', content: reply });
      history = history.slice(-MAX_TURNS);
      addMessage('assistant', reply);
    } catch (error) {
      hideTyping();
      history.pop(); // drop the unanswered question so the next turn still ends with a user message
      addMessage('error', error.message);
    } finally {
      busy = false;
      send.disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    ask(input.value);
  });

  /** Called whenever a new plan is created: starts a fresh conversation. */
  function reset() {
    history = [];
    log.replaceChildren();
    if (aiAvailable()) {
      setEnabled(true, 'Ask about vendors, budgets, schedules or etiquette for this event.');
      addMessage('assistant', 'Hi! I have your plan open. Ask me anything about it, or pick a question below to get started.');
    } else {
      setEnabled(false, 'The chat assistant is not available right now. Your plan above still works.');
    }
    renderChips();
  }

  return { reset };
}
