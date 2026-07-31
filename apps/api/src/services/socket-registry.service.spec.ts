import { Socket } from 'socket.io';
import { SocketRegistryService } from './socket-registry.service';

// Kasıtlı olarak Socket'in class-shape'ine cast EDİLMİYOR - jest.fn()
// alanlarını sınıf metodu gibi tiplemek `@typescript-eslint/unbound-method`
// kuralını `expect(mock.metod)` kullanımlarında tetikliyor (aynı desen
// test/support/email-service-mock.ts'de). Çağıran registry.register/
// unregister çağrılarında kendi tipini uyguluyor.
function buildSocketMock() {
  return { disconnect: jest.fn() };
}

function asSocket(mock: ReturnType<typeof buildSocketMock>): Socket {
  return mock as unknown as Socket;
}

describe('SocketRegistryService', () => {
  it('disconnectUser_sadece_o_kullanicinin_soketlerini_kapatir', () => {
    const registry = new SocketRegistryService();
    const socketA1 = buildSocketMock();
    const socketA2 = buildSocketMock();
    const socketB = buildSocketMock();

    registry.register('user-a', asSocket(socketA1));
    registry.register('user-a', asSocket(socketA2));
    registry.register('user-b', asSocket(socketB));

    registry.disconnectUser('user-a');

    expect(socketA1.disconnect).toHaveBeenCalledWith(true);
    expect(socketA2.disconnect).toHaveBeenCalledWith(true);
    expect(socketB.disconnect).not.toHaveBeenCalled();
  });

  it('disconnectUser_kayitsiz_kullaniciyi_sessizce_yoksayar', () => {
    const registry = new SocketRegistryService();

    expect(() => registry.disconnectUser('yok')).not.toThrow();
  });

  it('disconnectUser_ikinci_kez_cagrilinca_no_op', () => {
    const registry = new SocketRegistryService();
    const socket = buildSocketMock();
    registry.register('user-a', asSocket(socket));

    registry.disconnectUser('user-a');
    registry.disconnectUser('user-a');

    expect(socket.disconnect).toHaveBeenCalledTimes(1);
  });

  it('unregister_kayitsiz_soketi_sessizce_yoksayar', () => {
    const registry = new SocketRegistryService();
    const socket = buildSocketMock();

    expect(() => registry.unregister('yok', asSocket(socket))).not.toThrow();
  });

  it('unregister_sonra_disconnectUser_artik_hicbir_soketi_kapatmaz', () => {
    const registry = new SocketRegistryService();
    const socket = buildSocketMock();
    registry.register('user-a', asSocket(socket));

    registry.unregister('user-a', asSocket(socket));
    registry.disconnectUser('user-a');

    expect(socket.disconnect).not.toHaveBeenCalled();
  });
});
