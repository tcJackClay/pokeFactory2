import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { GameViewModel } from '../../view-model';
import { FactoryHeldItemRepairNotice } from './FactoryHeldItemRepairNotice';

/**
 * UI 侧覆盖（# Auditor (re-review) 残余 2）：提示必须**按标志出现/消失**，且关闭按钮确实接到
 * view model 的动作。view model 的 `heldItemBaselineRepaired` 是 `repaired && !dismissed`
 * 的合成结果，因此「关闭后 / 新挑战开始后」在渲染层等价于标志为假 —— 两种情形此处一并锁定。
 */
function makeViewModel(repaired: boolean, language = 'zh-hans') {
  let dismissed = 0;
  const viewModel = {
    currentLanguage: language,
    heldItemBaselineRepaired: repaired,
    dismissHeldItemRepairNotice: () => { dismissed += 1; },
  } as unknown as GameViewModel;
  return { viewModel, dismissedCount: () => dismissed };
}

function render(repaired: boolean, language?: string) {
  const { viewModel } = makeViewModel(repaired, language);
  return renderToStaticMarkup(createElement(FactoryHeldItemRepairNotice, { viewModel }));
}

test('the repair notice renders only while the repaired flag is set', () => {
  const shown = render(true);
  assert.match(shown, /data-testid="factory-held-item-repair-notice"/);
  assert.match(shown, /role="status"/);
  assert.match(shown, /已自动规整/);
  assert.match(shown, /任何道具都没有被丢弃、也没有进入背包/);
  assert.match(shown, /知道了/);
  // 标志为假（未发生过修复 / 玩家已关闭 / 新挑战开始已复位）⇒ 提示必须消失，不留残留。
  assert.equal(render(false), '');
});

test('the repair notice follows the language and wires its dismiss action', () => {
  const en = render(true, 'en');
  assert.match(en, /reconciled automatically/);
  assert.match(en, /Got it/);
  assert.doesNotMatch(en, /知道了/);

  const { viewModel, dismissedCount } = makeViewModel(true);
  const element = FactoryHeldItemRepairNotice({ viewModel }) as unknown as { props: { children: unknown } };
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children];
  const button = children.find((child) => (
    (child as { props?: { type?: string } } | null)?.props?.type === 'button'
  )) as unknown as { props: { onClick: () => void } } | undefined;
  assert.ok(button, 'the notice must expose a dismiss button');
  button.props.onClick();
  assert.equal(dismissedCount(), 1);
});
