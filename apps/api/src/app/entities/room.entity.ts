import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { FloorEntity } from './floor.entity';

@Entity({ name: 'rooms' })
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  position!: number;

  @Column({ type: 'varchar', length: 120, default: '' })
  label!: string;

  @ManyToOne(() => FloorEntity, (floor) => floor.rooms, {
    onDelete: 'CASCADE',
  })
  floor!: FloorEntity;
}