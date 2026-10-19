import { automationService } from '@/server/automation-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial comment to establish stream
      controller.enqueue(encoder.encode(': connected\n\n'));

      const unsubscribe = automationService.addListener((channel, payload) => {
        try {
          const data = JSON.stringify({ channel, payload });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream might be closed
        }
      });

      // Keepalive interval every 15 seconds
      const keepalive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'));
        } catch {
          clearInterval(keepalive);
        }
      }, 15000);

      request.signal.addEventListener('abort', () => {
        clearInterval(keepalive);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
