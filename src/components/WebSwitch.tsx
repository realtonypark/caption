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
    title="Search the web for supporting sources"
    onMouseDown={(event) => event.preventDefault()}
    onClick={() => onChange(!on)}
  >
    <Icon name="globe" /> Web
  </button>
);
