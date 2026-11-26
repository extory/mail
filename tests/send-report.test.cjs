/* eslint-disable @typescript-eslint/no-require-imports -- Render TypeScript component with controlled report state. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const filename = path.resolve(__dirname, '../src/components/send-report.tsx');
function render(report, showAccepted) {
  let stateIndex = 0;
  const component = new Module(filename, module);
  component.filename = filename;
  component.paths = module.paths;
  const originalRequire = component.require.bind(component);
  component.require = id => id === 'react' ? {
    ...React,
    useState: initial => [stateIndex++ === 0 ? report : stateIndex === 7 && showAccepted !== undefined ? showAccepted : initial, () => {}],
    useEffect: () => {}, useCallback: fn => fn,
  } : id === './locale-provider' ? { useLocale: () => ({ t: key => key }) } : originalRequire(id);
  component._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText, filename);
  return renderToStaticMarkup(React.createElement(component.exports.SendReport, { id: 1 }));
}
const accepted = { recipient_email: 'reader@company.co', resend_id: 'provider-1', last_event: 'delivered' };
const base = { tracked: true, retryable: 0, log: { status: 'sent' }, accepted: [accepted], recipients: [{ id: 1, email: accepted.recipient_email, resend_id: accepted.resend_id, state: 'accepted', error: null }] };
test('fully accepted send displays recipients and delivery results by default', () => {
  const html = render(base);
  assert.match(html, /reader@company.co/);
  assert.match(html, /send_report.state.accepted/);
  assert.match(html, /send_report.event.delivered/);
});
test('legacy sends show saved recipients and results without collapsed details', () => {
  const html = render({ ...base, tracked: false, recipients: [] });
  assert.match(html, /reader@company.co/);
  assert.match(html, /send_report.event.delivered/);
  assert.doesNotMatch(html, /<details/);
});
test('empty and filtered lists explain why there are no rows', () => {
  assert.match(render({ ...base, recipients: [], accepted: [] }), /send_report.empty/);
  const hidden = render(base, false);
  assert.match(hidden, /send_report.hidden/);
  assert.doesNotMatch(hidden, /reader@company.co/);
});

test('hard-bounce rows show manual selection and provider reasons for legacy and tracked reports', () => {
  for (const tracked of [true,false]) {
    const report = {...base, tracked, accepted:[{...accepted,last_event:'bounced',hardBounce:true,subscriberExists:true,bounceReason:'Mailbox does not exist'}]};
    const html = render(report);
    assert.match(html,/send_report.hard_bounce/);
    assert.match(html,/send_report.select_email/);
    assert.match(html,/Mailbox does not exist/);
    const deleted = render({...report,accepted:report.accepted.map(r=>({...r,subscriberExists:false}))});
    assert.match(deleted,/send_report.already_deleted/);
    assert.doesNotMatch(deleted,/send_report.select_email/);
  }
});

test('suppressed recipients can be selected in legacy and tracked reports', () => {
  for (const tracked of [true,false]) {
    const report = {...base, tracked, accepted:[{...accepted,last_event:'suppressed',suppressed:true,hardBounce:false,subscriberExists:true}]};
    const html = render(report);
    assert.match(html,/send_report.event.suppressed/);
    assert.match(html,/send_report.select_email/);
    const deleted = render({...report,accepted:report.accepted.map(r=>({...r,subscriberExists:false}))});
    assert.match(deleted,/send_report.already_deleted/);
    assert.doesNotMatch(deleted,/send_report.select_email/);
  }
});
