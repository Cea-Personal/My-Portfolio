import { Button, Status } from "@career-os/ui";

export function FactReviewQueue() {
  return (
    <section aria-labelledby="review-title">
      <h1 id="review-title">Fact review</h1>
      <Status>All extracted facts are candidates until reviewed.</Status>
      <Button>Open review queue</Button>
    </section>
  );
}
