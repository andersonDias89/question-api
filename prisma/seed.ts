import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12
  return bcrypt.hash(password, saltRounds)
}

async function main() {
  console.log('🌱 Starting database seed...')

  // Verificar se o usuário de teste já existe
  const existingUser = await prisma.user.findUnique({
    where: { email: 'andersondiasmd25@gmail.com' },
  })

  if (existingUser) {
    console.log('⚠️ Test user already exists, skipping seed...')
    return
  }

  // Criar usuário de teste
  const hashedPassword = await hashPassword('Photo1989#')

  const testUser = await prisma.user.create({
    data: {
      name: 'Barreto89',
      email: 'andersondiasmd25@gmail.com',
      password: hashedPassword,
    },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  })

  console.log('✅ Test user created successfully:')
  console.log('📧 Email:', testUser.email)
  console.log('👤 Name:', testUser.name)
  console.log('📅 Created at:', testUser.createdAt)
}

main()
  .catch(e => {
    console.error('❌ Error during seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
