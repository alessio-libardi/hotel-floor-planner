import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FloorEntity } from './entities/floor.entity';
import { PlanItemEntity } from './entities/plan-item.entity';
import { RoomEntity } from './entities/room.entity';
import { PlanController } from './plan.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      username: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      database: process.env.PGDATABASE || 'hotel_floor_planner',
      entities: [FloorEntity, RoomEntity, PlanItemEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([FloorEntity, RoomEntity, PlanItemEntity]),
  ],
  controllers: [AppController, PlanController],
  providers: [AppService],
})
export class AppModule {}
