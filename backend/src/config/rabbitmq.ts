import { connect, type Channel, type ChannelModel } from 'amqplib';

let _conn: ChannelModel | null = null;
let _channel: Channel | null = null;
let _connecting: Promise<void> | null = null;

export type PublishOptions = {
  exchange: string;
  routingKey: string;
  payload: unknown;
  persistent?: boolean;
};

export async function ensureRabbitConnected(): Promise<void> {
  if (_channel) return;
  if (_connecting) return _connecting;

  let url = process.env.RABBITMQ_URL?.trim();
  if (!url) {
    // `.env` lines with spaces around `=` can produce env keys with trailing spaces in some setups.
    // Best-effort fallback: find any key that trims to `RABBITMQ_URL`.
    const alt = Object.entries(process.env).find(([k, v]) => k.trim() === 'RABBITMQ_URL' && typeof v === 'string');
    url = typeof alt?.[1] === 'string' ? alt[1].trim() : undefined;
  }
  if (!url) {
    throw new Error('RABBITMQ_URL is not configured');
  }

  _connecting = (async () => {
    _conn = await connect(url);
    _conn.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('RabbitMQ connection error:', err);
    });
    _conn.on('close', () => {
      _conn = null;
      _channel = null;
      _connecting = null;
    });

    _channel = await _conn.createChannel();
  })().finally(() => {
    _connecting = null;
  });

  await _connecting;
}

export async function rabbitChannel(): Promise<Channel> {
  await ensureRabbitConnected();
  if (!_channel) throw new Error('RabbitMQ channel not ready');
  return _channel;
}

export async function publishEvent(opts: PublishOptions): Promise<void> {
  const ch = await rabbitChannel();

  await ch.assertExchange(opts.exchange, 'topic', { durable: true });
  const buf = Buffer.from(JSON.stringify(opts.payload), 'utf8');
  ch.publish(opts.exchange, opts.routingKey, buf, {
    contentType: 'application/json',
    persistent: opts.persistent ?? true,
  });
}

