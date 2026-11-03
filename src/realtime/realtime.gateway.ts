import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { getSecret } from '../common/env.js';
import { SessionService } from '../auth/session.service.js';
import { UserService } from '../user/user.service.js';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    sessionId?: string;
    organizationId?: string;
  };
}

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: '/realtime',
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly sessions: SessionService,
    private readonly userService: UserService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.toString().replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: getSecret(this.configService, 'JWT_SECRET', 'fallback-secret'),
      });

      if (payload.purpose || !payload.sid) {
        client.disconnect();
        return;
      }

      if (!(await this.sessions.isFamilyActive(payload.sid))) {
        client.disconnect();
        return;
      }

      const user = await this.userService.findById(payload.sub);
      if (!user || !user.isVerified) {
        client.disconnect();
        return;
      }

      client.data.userId = user.id;
      client.data.sessionId = payload.sid;
      client.join(`user:${user.id}`);
      this.logger.debug(`User ${user.id} connected`);
    } catch {
      this.logger.debug('Socket auth failed');
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.debug(`User ${client.data?.userId} disconnected`);
  }

  @SubscribeMessage('join:task')
  async joinTask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId: string; organizationId?: string },
  ) {
    if (!client.data?.userId || !data?.taskId) return { ok: false };
    if (data.organizationId) {
      client.data.organizationId = data.organizationId;
      client.join(`org:${data.organizationId}`);
    }
    client.join(`task:${data.taskId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:subtask')
  async joinSubtask(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { subtaskId: string; organizationId?: string },
  ) {
    if (!client.data?.userId || !data?.subtaskId) return { ok: false };
    if (data.organizationId) {
      client.data.organizationId = data.organizationId;
      client.join(`org:${data.organizationId}`);
    }
    client.join(`subtask:${data.subtaskId}`);
    return { ok: true };
  }

  @SubscribeMessage('join:project')
  async joinProject(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { projectId: string; organizationId?: string },
  ) {
    if (!client.data?.userId || !data?.projectId) return { ok: false };
    if (data.organizationId) {
      client.data.organizationId = data.organizationId;
      client.join(`org:${data.organizationId}`);
    }
    client.join(`project:${data.projectId}`);
    return { ok: true };
  }

  @SubscribeMessage('typing:start')
  onTypingStart(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId?: string; subtaskId?: string },
  ) {
    if (data.taskId) {
      client.to(`task:${data.taskId}`).emit('typing:start', {
        userId: client.data.userId,
        taskId: data.taskId,
      });
    }
    if (data.subtaskId) {
      client.to(`subtask:${data.subtaskId}`).emit('typing:start', {
        userId: client.data.userId,
        subtaskId: data.subtaskId,
      });
    }
  }

  @SubscribeMessage('typing:stop')
  onTypingStop(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { taskId?: string; subtaskId?: string },
  ) {
    if (data.taskId) {
      client.to(`task:${data.taskId}`).emit('typing:stop', {
        userId: client.data.userId,
        taskId: data.taskId,
      });
    }
    if (data.subtaskId) {
      client.to(`subtask:${data.subtaskId}`).emit('typing:stop', {
        userId: client.data.userId,
        subtaskId: data.subtaskId,
      });
    }
  }

  emitToTask(taskId: string, event: string, payload: any) {
    this.server.to(`task:${taskId}`).emit(event, payload);
  }

  emitToSubtask(subtaskId: string, event: string, payload: any) {
    this.server.to(`subtask:${subtaskId}`).emit(event, payload);
  }

  emitToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }
}
