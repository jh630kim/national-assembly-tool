# 최신 웹 애니메이션 적용 기준

2026-11-10 기준. 효과를 적용할 때 필요한 부분만 읽는다. 브라우저 지원 범위가 정해져 있다면 그 범위를 먼저 확인한다.

## 스크롤에 따라 진행하는 효과

스크롤 위치가 애니메이션의 진행률을 직접 결정하면 CSS `animation-timeline: scroll()` 또는 `view()`를 우선 검토한다. 2026년 10월부터 최신 브라우저에서 폭넓게 지원되지만 구형 브라우저에서는 대체 동작이 필요하다. CSS `animation` 약식 선언 뒤에 `animation-timeline`을 선언한다.

```css
.progress { transform-origin: left; }
@keyframes grow { to { transform: scaleX(1); } }
@supports (animation-timeline: scroll()) {
  .progress {
    transform: scaleX(0);
    animation: grow linear both;
    animation-timeline: scroll(root block);
  }
}
@media (prefers-reduced-motion: reduce) {
  .progress { animation: none; transform: none; }
}
```

미지원 브라우저에서는 효과를 생략해도 정보가 보이는 상태를 기본값으로 둔다. 정확한 스크럽 동작이 필수라면 필요한 요소에만 JS 대체 구현을 둔다. 스크롤 이벤트에는 최소한의 상태 갱신만 하고 화면 갱신을 `requestAnimationFrame`에 모은다. 화면에 보이지 않는 동안에는 반복 실행을 멈춘다.

근거: [MDN animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline), [MDN CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations).

## 화면 상태·페이지 전환

같은 문서 안에서 화면 상태가 바뀌는 경우 `document.startViewTransition()`을 선택적으로 사용한다. API가 없거나 움직임 줄이기를 요청한 환경에서는 상태 변경만 실행한다. 다른 문서로 이동하는 전환은 같은 출처의 두 문서가 모두 `@view-transition { navigation: auto; }`를 설정해야 한다. 단순한 버튼·카드 효과에는 이 API를 쓰지 않는다.

```js
const update = () => { /* 기존 화면 상태 변경 */ };
if (document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches) {
  document.startViewTransition(update);
} else {
  update();
}
```

근거: [MDN View Transition API 사용법](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using).

## 등장 효과와 접근성

콘텐츠는 기본적으로 보이게 둔다. `IntersectionObserver`가 실제로 설정된 후에만 움직임을 위한 시작 상태를 적용한다. JS가 없거나 API가 지원되지 않아도 내용이 숨겨지면 안 된다. 반복 이동·확대 효과는 `prefers-reduced-motion: reduce`에서 제거하거나 정적인 상태로 바꾸되, 정보와 조작 기능은 유지한다.

근거: [MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-reduced-motion).

## 성능과 확인

- 가능하면 `transform`과 `opacity`로 움직인다. `will-change`는 실제 성능 문제가 확인된 요소에 제한적으로 사용한다.
- 자동 반복, 스크롤 반응, 페이지 전환은 모바일 기기와 움직임 줄이기 설정에서 확인한다.
- 지원하지 않는 브라우저에서도 핵심 정보와 조작이 가능한지 확인한다.
- 기존 프로젝트에 애니메이션 라이브러리가 있으면 그 방식과 충돌하지 않도록 선택한다.

근거: [web.dev 고성능 CSS 애니메이션](https://web.dev/articles/animations-guide).
