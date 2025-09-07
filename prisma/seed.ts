import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

// Enum local para corresponder ao schema
enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

async function main() {
  console.log('🌱 Starting database seed...')

  // Verificar se o admin já existe
  const existingAdmin = await prisma.user.findUnique({
    where: { email: 'andersondiasmd25@gmail.com' },
  })

  if (existingAdmin) {
    console.log('⚠️ Admin user already exists, skipping seed...')
    return
  }

  // Criar usuário admin
  const hashedPassword = await hashPassword('Photo1989#')

  const adminUser = await prisma.user.create({
    data: {
      name: 'Barreto89',
      email: 'andersondiasmd25@gmail.com',
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  })

  console.log('✅ Admin user created successfully:')
  console.log('📧 Email:', adminUser.email)
  console.log('👤 Name:', adminUser.name)
  console.log('🔐 Role:', adminUser.role)
  console.log('📅 Created at:', adminUser.createdAt)
}

main()
  .catch(e => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
