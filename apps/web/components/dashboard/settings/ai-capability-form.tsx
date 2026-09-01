export function AiCapabilityForm() {
  return (
    <form aria-label="AI capability settings">
      <label>
        Task{" "}
        <select defaultValue="chat">
          <option value="chat">Public chat</option>
        </select>
      </label>
    </form>
  );
}
