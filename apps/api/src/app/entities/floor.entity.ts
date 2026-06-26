import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RoomEntity } from './room.entity';

@Entity({ name: 'floors' })
export class FloorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int', unique: true })
  number!: number;

  @OneToMany(() => RoomEntity, (room) => room.floor, {
    cascade: true,
  })
  rooms!: RoomEntity[];
}