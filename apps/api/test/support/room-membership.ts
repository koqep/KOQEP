import { PrismaService } from '../../src/db/prisma.service';

// M7a Slice B: gerçek zamanlı yayın artık üyelik-scoped
// (messages.gateway.ts'in handleConnection'ı) - doğrudan prisma.user.create
// ile (signup'ı bypass ederek) oluşturulan test kullanıcıları otomatik
// çekirdek-oda üyeliği KAZANMAZ (o sadece AuthService.signup()'ın kendi
// transaction'ında olur). Bir testin socket'i belirli bir odada broadcast
// almasını/blok-filtrelemesini/vb. iddia etmesi gerekiyorsa bu yardımcıyla
// açıkça üye yapılmalı - aksi halde handleConnection o odaya hiç join
// etmez, test sessizce timeout'a düşer (assertion hatası değil).
export async function joinRoomByName(
  prisma: PrismaService,
  userId: string,
  roomName: string,
): Promise<void> {
  const room = await prisma.room.findUniqueOrThrow({
    where: { name: roomName },
  });
  await prisma.roomMember.upsert({
    where: { userId_roomId: { userId, roomId: room.id } },
    create: { userId, roomId: room.id },
    update: {},
  });
}
