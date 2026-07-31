import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

// AuthService ile MessagesGateway arasında döngüsel bağımlılık kurmadan
// hesap silindiğinde o kullanıcının açık soketlerini koparabilmek için
// paylaşılan, bağımlılıksız bir kayıt (ikisi de bu servise aşağı doğru
// bağımlı). M2.5 Slice D - Slice C'nin "silinmiş kullanıcının hâlâ açık
// soketi sessizce yutuluyor" tespitinin gerçek çözümü.
@Injectable()
export class SocketRegistryService {
  private readonly socketsByUserId = new Map<string, Set<Socket>>();

  register(userId: string, socket: Socket): void {
    const sockets = this.socketsByUserId.get(userId) ?? new Set<Socket>();
    sockets.add(socket);
    this.socketsByUserId.set(userId, sockets);
  }

  unregister(userId: string, socket: Socket): void {
    const sockets = this.socketsByUserId.get(userId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) {
      this.socketsByUserId.delete(userId);
    }
  }

  disconnectUser(userId: string): void {
    const sockets = this.socketsByUserId.get(userId);
    if (!sockets) return;
    for (const socket of sockets) {
      socket.disconnect(true);
    }
    this.socketsByUserId.delete(userId);
  }
}
