export default function TextField(props: {
  label: string;
  value: string;
  onInput: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {props.label}
      <input
        type={props.type ?? "text"}
        value={props.value}
        onInput={(event) => props.onInput(event.currentTarget.value)}
        required={props.required}
      />
    </label>
  );
}
