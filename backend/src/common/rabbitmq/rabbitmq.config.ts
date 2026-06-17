import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://scraper:scraperpass@localhost:5672',
  queue: process.env.RABBITMQ_QUEUE || 'scraping_jobs',
  pageFetchQueue: process.env.RABBITMQ_PAGE_FETCH_QUEUE || 'page-fetch',
}));
