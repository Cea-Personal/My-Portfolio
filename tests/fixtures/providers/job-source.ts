export function fakeJobSource() {
  return {
    source: "fake",
    adapterVersion: "fake-v1",
    async collect() {
      return [];
    }
  };
}
