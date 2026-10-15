# Book opening

This frontend change starts at the clicked shelf book and ends at its existing reading route.

- Keep the book's design and initial scroll pose. Isolate a temporary visual copy, lift it into a portrait cover, and hinge the cover to expose paper.
- Expand that paper into the actual reader with the native View Transition API. Use Web Animations for the lift and hinge and for paper expansion when View Transitions are unavailable. Add no dependencies.
- Keep motion in `src/open-book.ts`; keep reading data, persistence, and route definitions in their existing owners. The caller supplies the navigation callback.
- Ignore repeated activation during opening. Escape and browser history changes cancel pending navigation. Remove the overlay and restore interaction after completion or cancellation. Focus the reader title on arrival.
- Skip motion for reduced-motion preferences or unavailable animation support. Links/PDF input and other navigation retain their current behavior.

Review the actual desktop and mobile opening, including the cover hinge and reader expansion. Check repeated activation, cancellation, focus, reduced motion, and the API fallback. This remains a frontend demo without backend changes.
