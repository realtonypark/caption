export interface MarginPosition {
  id: string;
  desired: number;
  height: number;
  mini: boolean;
}

// Active cards stay beside their passages; neighbors settle away from them.
export const placeMarginCards = (
  items: MarginPosition[],
  activeId?: string,
): Record<string, number> => {
  const tops = items.map((item) => item.desired);
  const active = items.findIndex((item) => item.id === activeId);
  const gap = (index: number) =>
    items[index].mini && items[index + 1].mini ? 4 : 16;
  const forward = (from: number) => {
    for (let index = Math.max(1, from); index < items.length; index++) {
      tops[index] = Math.max(
        tops[index],
        tops[index - 1] + items[index - 1].height + gap(index - 1),
      );
    }
  };
  if (active < 0) {
    tops[0] = Math.max(0, tops[0] ?? 0);
    forward(1);
  } else {
    forward(active + 1);
    for (let index = active - 1; index >= 0; index--) {
      tops[index] = Math.min(
        tops[index],
        tops[index + 1] - gap(index) - items[index].height,
      );
    }
    if (tops[0] < 0) {
      tops[0] = 0;
      forward(1);
    }
  }
  return Object.fromEntries(items.map((item, index) => [item.id, tops[index]]));
};
