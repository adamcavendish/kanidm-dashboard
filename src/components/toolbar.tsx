import { Search } from "lucide-solid";

export function Toolbar(props: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div class="toolbar">
      <Search size={17} />
      <input
        aria-label={props.placeholder}
        value={props.query}
        onInput={(event) => props.onQuery(event.currentTarget.value)}
        placeholder={props.placeholder}
      />
    </div>
  );
}
