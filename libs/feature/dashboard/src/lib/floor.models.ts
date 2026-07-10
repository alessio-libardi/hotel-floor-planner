export interface RoomViewModel {
  id: string;
  label: string;
  number: number;
  arrivalDate: string | null;
  departureDate: string | null;
  checkedDate: string | null;
}

export interface FloorViewModel {
  id: string;
  number: number;
  rooms: RoomViewModel[];
}
