import { OnGatewayConnection, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

/**
 * LLD §4.4 / §6.2 — running-timer indicator. Clients join a per-project room
 * (`project:{code}:timers`) and receive `{ticketId, running}` pushes instead
 * of polling every ticket row. TicketsService.startTimer/stopTimer call
 * `broadcastTimerState` after each DB write.
 */
@WebSocketGateway({ cors: { origin: '*' }, namespace: 'timers' })
export class TimersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    client.emit('connected', { ok: true });
  }

  @SubscribeMessage('join-project')
  joinProject(client: Socket, projectCode: string) {
    client.join(roomFor(projectCode));
  }

  @SubscribeMessage('leave-project')
  leaveProject(client: Socket, projectCode: string) {
    client.leave(roomFor(projectCode));
  }

  broadcastTimerState(projectCode: string, ticketId: string, running: boolean) {
    this.server.to(roomFor(projectCode)).emit('timer-state', { ticketId, running });
  }
}

function roomFor(projectCode: string) {
  return `project:${projectCode}:timers`;
}
