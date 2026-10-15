import { Icon } from "./Icon";

export const WebSwitch = ({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (on: boolean) => void;
}) => (
  <button
    type="button"
    className="web-switch"
    aria-label="Search the web"
    aria-pressed={on}
    title="Web search preview. Demo answers use sample text."
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => onChange(!on)}
  >
    <Icon name="globe" /> Web
  </button>
);
