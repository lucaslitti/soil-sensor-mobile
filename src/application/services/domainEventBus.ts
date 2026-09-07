import type { DomainEvent, DomainEventPublisher } from '../../domain/events/domainEvents';

type Handler = (event: DomainEvent) => void;

export class ApplicationEventBus implements DomainEventPublisher {
  private readonly handlers = new Set<Handler>();

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  publish(event: DomainEvent): void {
    for (const handler of this.handlers) handler(event);
  }
}
