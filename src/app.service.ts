import {
  CACHE_MANAGER,
  GatewayTimeoutException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, delay, map, retryWhen, tap } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Planet } from './planet.interface';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);
  // We can get this by api, but I think that's not main task
  private static readonly TOTAL_PLANETS = 60;
  // When we have some errors from adapter-node we try to retry request
  public static readonly RETRIES = 5;

  constructor(
    private httpService: HttpService,
    private configService: ConfigService,
    @Inject(CACHE_MANAGER) private cache: Cache,
  ) {}

  async getRandomPlanet(): Promise<Planet> {
    // try to get planet from cache
    let planet: Planet = await this.cache.get('planet');
    planet && this.logger.log('Planet gotten from cache');

    // if no planet, try get it from adapter
    if (!planet) {
      this.logger.log('Try to get planet from the adapter-node');
      planet = await this.fetchPlanet();
      this.logger.log('Success. Planet gotten from the adapter-node');

      // and set it into cache
      await this.cache.set('planet', planet, { ttl: 3 });
    }

    return planet;
  }

  fetchPlanet(): Promise<Planet> {
    const adapterNodeUrl = this.configService.get('ADAPTER_NODE_SERVER');
    const randomId = Math.floor(Math.random() * AppService.TOTAL_PLANETS) + 1;
    const url = [adapterNodeUrl, 'planets', randomId].join('/');
    let retries = 1;
    return this.httpService
      .get(url)
      .pipe(
        map(({ data }): Planet => {
          this.logger.log('Planet successfully fetched from adapter-node');
          return data as Planet;
        }),
        retryWhen((error) =>
          error.pipe(
            // log error message
            tap((err) => {
              this.logger.warn(err);
              if (retries > AppService.RETRIES) {
                throw new GatewayTimeoutException();
              }
              this.logger.log(`Trying to reconnect...${retries++} try`);
            }),
            // retry request after 1 second
            delay(1000),
          ),
        ),
        catchError((error) => throwError(error)),
      )
      .toPromise();
  }
}
