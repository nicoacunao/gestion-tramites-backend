export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventName: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
