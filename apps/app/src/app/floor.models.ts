export interface RoomViewModel {
  id: string;
  label: string;
  number: number;
}

export interface FloorViewModel {
  id: string;
  number: number;
  rooms: RoomViewModel[];
}
