import { Injectable, inject } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  updateDoc,
  where,
} from 'firebase/firestore';
import { from } from 'rxjs';
import { FloorViewModel, RoomViewModel } from './floor.models';
import { AuthService } from '@util/auth';
import { Firestore } from '@angular/fire/firestore';
import {
  compareTableNumbers,
  nextGeneratedTableNumber,
  normalizeTableNumber,
} from './table-number';
import { normalizeRoomNumbers, primaryRoomNumber } from './room-assignment';

export type PlanItemType = 'table' | 'column' | 'label';

export interface PlanItemDto {
  id: string;
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: string | null;
  roomNumber: number | null;
  roomNumbers: number[];
  linkedTableIds: string[];
}

interface RoomDoc {
  id: string;
  label: string;
  position: number;
  arrivalDate: string | null;
  departureDate: string | null;
  checkedDate: string | null;
  note?: string | null;
}

interface FloorDoc {
  number: number;
  rooms: RoomDoc[];
}

interface PlanItemDoc {
  type: PlanItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  tableNumber: string | null;
  roomNumber: number | null;
  roomNumbers?: number[];
  linkedTableIds: string[];
}

@Injectable({ providedIn: 'root' })
export class FloorPlannerApi {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);

  getFloors() {
    return from(this.getFloorsInternal());
  }

  createFloor() {
    return from(this.createFloorInternal());
  }

  deleteFloor(floorId: string) {
    return from(this.deleteFloorInternal(floorId));
  }

  createRoom(floorId: string) {
    return from(this.createRoomInternal(floorId));
  }

  updateRoom(floorId: string, roomId: string, label: string) {
    return from(this.updateRoomInternal(floorId, roomId, label));
  }

  updateRoomDetails(
    floorId: string,
    roomId: string,
    details: Pick<RoomViewModel, 'arrivalDate' | 'departureDate' | 'note'>
  ) {
    return from(this.updateRoomDetailsInternal(floorId, roomId, details));
  }

  updateRoomCheckedDate(
    floorId: string,
    roomId: string,
    checkedDate: string | null
  ) {
    return from(
      this.updateRoomCheckedDateInternal(floorId, roomId, checkedDate)
    );
  }

  deleteRoom(floorId: string, roomId: string) {
    return from(this.deleteRoomInternal(floorId, roomId));
  }

  getPlanItems() {
    return from(this.getPlanItemsInternal());
  }

  createPlanItem(type: PlanItemType) {
    return from(this.createPlanItemInternal(type));
  }

  updatePlanItem(
    itemId: string,
    patch: Partial<
      Pick<
        PlanItemDto,
        | 'x'
        | 'y'
        | 'width'
        | 'height'
        | 'text'
        | 'tableNumber'
        | 'roomNumber'
        | 'roomNumbers'
        | 'linkedTableIds'
      >
    >
  ) {
    return from(this.updatePlanItemInternal(itemId, patch));
  }

  deletePlanItem(itemId: string) {
    return from(this.deletePlanItemInternal(itemId));
  }

  private async getFloorsInternal(): Promise<FloorViewModel[]> {
    this.auth.requireUser();

    const floorsSnapshot = await getDocs(
      query(collection(this.firestore, 'floors'), orderBy('number', 'asc'))
    );

    return floorsSnapshot.docs.map((entry) =>
      this.toFloorModel(entry.id, entry.data() as FloorDoc)
    );
  }

  private async createFloorInternal(): Promise<FloorViewModel> {
    this.auth.requireUser();

    const maxSnapshot = await getDocs(
      query(
        collection(this.firestore, 'floors'),
        orderBy('number', 'desc'),
        limit(1)
      )
    );
    const maxFloor = maxSnapshot.docs[0]?.data() as FloorDoc | undefined;
    const nextFloorNumber = (maxFloor?.number ?? 0) + 1;

    const result = await runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(collection(this.firestore, 'floors'));
      const floorPayload: FloorDoc = {
        number: nextFloorNumber,
        rooms: [],
      };

      transaction.set(floorRef, floorPayload);

      return this.toFloorModel(floorRef.id, floorPayload);
    });

    return result;
  }

  private async deleteFloorInternal(
    floorId: string
  ): Promise<{ deleted: true }> {
    this.auth.requireUser();

    await deleteDoc(doc(this.firestore, 'floors', floorId));
    return { deleted: true };
  }

  private async createRoomInternal(floorId: string): Promise<RoomViewModel> {
    this.auth.requireUser();

    return runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(this.firestore, 'floors', floorId);
      const floorSnapshot = await transaction.get(floorRef);

      if (!floorSnapshot.exists()) {
        throw new Error('Floor not found');
      }

      const floorData = floorSnapshot.data() as FloorDoc;
      const rooms = [...(floorData.rooms ?? [])];
      const nextPosition =
        Math.max(0, ...rooms.map((room) => room.position)) + 1;
      const roomId = this.createId();

      const nextRoom: RoomDoc = {
        id: roomId,
        position: nextPosition,
        label: `Room ${floorData.number * 100 + nextPosition}`,
        arrivalDate: null,
        departureDate: null,
        checkedDate: null,
        note: null,
      };

      transaction.update(floorRef, { rooms: [...rooms, nextRoom] });

      return {
        id: nextRoom.id,
        label: nextRoom.label,
        number: floorData.number * 100 + nextRoom.position,
        arrivalDate: nextRoom.arrivalDate,
        departureDate: nextRoom.departureDate,
        checkedDate: nextRoom.checkedDate,
        note: nextRoom.note ?? null,
      };
    });
  }

  private async updateRoomInternal(
    floorId: string,
    roomId: string,
    label: string
  ): Promise<RoomViewModel> {
    this.auth.requireUser();

    return runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(this.firestore, 'floors', floorId);
      const floorSnapshot = await transaction.get(floorRef);

      if (!floorSnapshot.exists()) {
        throw new Error('Floor not found');
      }

      const floorData = floorSnapshot.data() as FloorDoc;
      const rooms = [...(floorData.rooms ?? [])];
      const roomIndex = rooms.findIndex((room) => room.id === roomId);

      if (roomIndex < 0) {
        throw new Error('Room not found');
      }

      const updatedRoom: RoomDoc = {
        ...rooms[roomIndex],
        label: label.trim(),
      };

      rooms[roomIndex] = updatedRoom;
      transaction.update(floorRef, { rooms });

      return {
        id: updatedRoom.id,
        label: updatedRoom.label,
        number: floorData.number * 100 + updatedRoom.position,
        arrivalDate: updatedRoom.arrivalDate,
        departureDate: updatedRoom.departureDate,
        checkedDate: updatedRoom.checkedDate,
        note: updatedRoom.note ?? null,
      };
    });
  }

  private async deleteRoomInternal(
    floorId: string,
    roomId: string
  ): Promise<{ deleted: true }> {
    this.auth.requireUser();

    await runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(this.firestore, 'floors', floorId);
      const floorSnapshot = await transaction.get(floorRef);

      if (!floorSnapshot.exists()) {
        throw new Error('Floor not found');
      }

      const floorData = floorSnapshot.data() as FloorDoc;
      const remainingRooms = (floorData.rooms ?? [])
        .filter((room) => room.id !== roomId)
        .sort((left, right) => left.position - right.position)
        .map((room, index) => ({ ...room, position: index }));

      transaction.update(floorRef, { rooms: remainingRooms });
    });

    return { deleted: true };
  }

  private async updateRoomDetailsInternal(
    floorId: string,
    roomId: string,
    details: Pick<RoomViewModel, 'arrivalDate' | 'departureDate' | 'note'>
  ): Promise<RoomViewModel> {
    this.auth.requireUser();

    return runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(this.firestore, 'floors', floorId);
      const floorSnapshot = await transaction.get(floorRef);

      if (!floorSnapshot.exists()) {
        throw new Error('Floor not found');
      }

      const floorData = floorSnapshot.data() as FloorDoc;
      const rooms = [...(floorData.rooms ?? [])];
      const roomIndex = rooms.findIndex((room) => room.id === roomId);

      if (roomIndex < 0) {
        throw new Error('Room not found');
      }

      const updatedRoom: RoomDoc = {
        ...rooms[roomIndex],
        arrivalDate: details.arrivalDate,
        departureDate: details.departureDate,
        note: details.note,
      };

      rooms[roomIndex] = updatedRoom;
      transaction.update(floorRef, { rooms });

      return {
        id: updatedRoom.id,
        label: updatedRoom.label,
        number: floorData.number * 100 + updatedRoom.position,
        arrivalDate: updatedRoom.arrivalDate,
        departureDate: updatedRoom.departureDate,
        checkedDate: updatedRoom.checkedDate,
        note: updatedRoom.note ?? null,
      };
    });
  }

  private async updateRoomCheckedDateInternal(
    floorId: string,
    roomId: string,
    checkedDate: string | null
  ): Promise<RoomViewModel> {
    this.auth.requireUser();

    return runTransaction(this.firestore, async (transaction) => {
      const floorRef = doc(this.firestore, 'floors', floorId);
      const floorSnapshot = await transaction.get(floorRef);

      if (!floorSnapshot.exists()) {
        throw new Error('Floor not found');
      }

      const floorData = floorSnapshot.data() as FloorDoc;
      const rooms = [...(floorData.rooms ?? [])];
      const roomIndex = rooms.findIndex((room) => room.id === roomId);

      if (roomIndex < 0) {
        throw new Error('Room not found');
      }

      const updatedRoom: RoomDoc = {
        ...rooms[roomIndex],
        checkedDate,
      };

      rooms[roomIndex] = updatedRoom;
      transaction.update(floorRef, { rooms });

      return {
        id: updatedRoom.id,
        label: updatedRoom.label,
        number: floorData.number * 100 + updatedRoom.position,
        arrivalDate: updatedRoom.arrivalDate,
        departureDate: updatedRoom.departureDate,
        checkedDate: updatedRoom.checkedDate,
        note: updatedRoom.note ?? null,
      };
    });
  }

  private async getPlanItemsInternal(): Promise<PlanItemDto[]> {
    this.auth.requireUser();

    const planItemsSnapshot = await getDocs(
      query(
        collection(this.firestore, 'planItems'),
        orderBy('type', 'asc'),
        orderBy('__name__', 'asc')
      )
    );

    const items = planItemsSnapshot.docs.map((entry) =>
      this.toPlanItemModel(entry.id, entry.data() as PlanItemDoc)
    );

    return items.sort((left, right) => {
      if (left.type !== right.type) {
        return left.type.localeCompare(right.type);
      }

      if (left.tableNumber == null && right.tableNumber == null) {
        return left.id.localeCompare(right.id);
      }

      if (left.tableNumber == null) {
        return 1;
      }

      if (right.tableNumber == null) {
        return -1;
      }

      if (left.tableNumber !== right.tableNumber) {
        return compareTableNumbers(left.tableNumber, right.tableNumber);
      }

      return left.id.localeCompare(right.id);
    });
  }

  private async createPlanItemInternal(
    type: PlanItemType
  ): Promise<PlanItemDto> {
    this.auth.requireUser();

    let nextTableNumber: string | null = null;

    if (type === 'table') {
      const tableSnapshot = await getDocs(
        collection(this.firestore, 'planItems')
      );

      nextTableNumber = nextGeneratedTableNumber(
        tableSnapshot.docs
          .map((entry) => entry.data() as PlanItemDoc)
          .filter((item) => item.type === 'table')
          .map((item) => normalizeTableNumber(item.tableNumber))
      );
    }

    return runTransaction(this.firestore, async (transaction) => {
      const itemRef = doc(collection(this.firestore, 'planItems'));
      const payload: PlanItemDoc = {
        type,
        x: 48,
        y: 48,
        width: type === 'label' ? 120 : 74,
        height: type === 'label' ? 28 : 74,
        text: type === 'column' ? 'Column' : '',
        tableNumber: nextTableNumber,
        roomNumber: null,
        roomNumbers: [],
        linkedTableIds: [],
      };

      transaction.set(itemRef, payload);
      return this.toPlanItemModel(itemRef.id, payload);
    });
  }

  private async updatePlanItemInternal(
    itemId: string,
    patch: Partial<
      Pick<
        PlanItemDto,
        | 'x'
        | 'y'
        | 'width'
        | 'height'
        | 'text'
        | 'tableNumber'
        | 'roomNumber'
        | 'roomNumbers'
        | 'linkedTableIds'
      >
    >
  ): Promise<PlanItemDto> {
    this.auth.requireUser();

    const itemRef = doc(this.firestore, 'planItems', itemId);
    const updatePayload = this.withDefinedValues(patch);

    if (Object.keys(updatePayload).length > 0) {
      await updateDoc(itemRef, updatePayload);
    }

    const snapshot = await getDoc(itemRef);

    if (!snapshot.exists()) {
      throw new Error('Plan item not found');
    }

    return this.toPlanItemModel(snapshot.id, snapshot.data() as PlanItemDoc);
  }

  private async deletePlanItemInternal(
    itemId: string
  ): Promise<{ deleted: true }> {
    this.auth.requireUser();

    const itemRef = doc(this.firestore, 'planItems', itemId);
    const itemSnapshot = await getDoc(itemRef);
    const item = itemSnapshot.exists()
      ? (itemSnapshot.data() as PlanItemDoc)
      : null;

    await deleteDoc(itemRef);

    if (item?.type === 'table') {
      const linkedItemsSnapshot = await getDocs(
        query(
          collection(this.firestore, 'planItems'),
          where('linkedTableIds', 'array-contains', itemId)
        )
      );

      await Promise.all(
        linkedItemsSnapshot.docs.map((entry) => {
          const linkedTableIds = (
            (entry.data() as PlanItemDoc).linkedTableIds ?? []
          ).filter((linkedId) => linkedId !== itemId);

          return updateDoc(entry.ref, { linkedTableIds });
        })
      );
    }

    return { deleted: true };
  }

  private toFloorModel(id: string, floor: FloorDoc): FloorViewModel {
    const rooms = [...(floor.rooms ?? [])]
      .sort((left, right) => left.position - right.position)
      .map((room) => ({
        id: room.id,
        label: room.label,
        number: floor.number * 100 + room.position,
        arrivalDate: room.arrivalDate ?? null,
        departureDate: room.departureDate ?? null,
        checkedDate: room.checkedDate ?? null,
        note: room.note ?? null,
      }));

    return {
      id,
      number: floor.number,
      rooms,
    };
  }

  private toPlanItemModel(id: string, item: PlanItemDoc): PlanItemDto {
    return {
      id,
      type: item.type,
      x: item.x,
      y: item.y,
      width: item.width,
      height: item.height,
      text: item.text,
      tableNumber: normalizeTableNumber(item.tableNumber),
      roomNumber: primaryRoomNumber(
        normalizeRoomNumbers(item.roomNumbers, item.roomNumber)
      ),
      roomNumbers: normalizeRoomNumbers(item.roomNumbers, item.roomNumber),
      linkedTableIds: item.linkedTableIds ?? [],
    };
  }

  private withDefinedValues<T extends Record<string, unknown>>(
    value: T
  ): Partial<T> {
    return Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined)
    ) as Partial<T>;
  }

  private createId(): string {
    return globalThis.crypto?.randomUUID
      ? globalThis.crypto.randomUUID()
      : `room_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }
}
