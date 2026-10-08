import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private dummyHash!: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await hash('unused-invalid-credentials', 12);
  }

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });
    const matches = await compare(
      input.password,
      user?.passwordHash ?? this.dummyHash,
    );
    if (!user || !matches || Buffer.byteLength(input.password, 'utf8') > 72) {
      throw new UnauthorizedException('Invalid email or password.');
    }
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: { id: user.id, email: user.email, role: user.role },
    };
  }
}
