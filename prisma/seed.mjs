import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // create two users
  const olena = await prisma.user.upsert({
    where: { email: 'olena@example.com' },
    update: {},
    create: {
      email: 'olena@example.com',
      name: 'Olena K.',
      role: 'TUTOR',
      locale: 'uk',
      tutor: {
        create: {
          bio: 'CELTA certified English tutor with 7+ years experience.',
          headline: 'English for work and study',
          rateCents: 30000,
          currency: 'UAH',
          languages: ['uk', 'en'],
          subjects: ['english'],
        },
      },
    },
  })

  const dmytro = await prisma.user.upsert({
    where: { email: 'dmytro@example.com' },
    update: {},
    create: {
      email: 'dmytro@example.com',
      name: 'Dmytro P.',
      role: 'TUTOR',
      locale: 'uk',
      tutor: {
        create: {
          bio: 'Math olympiad mentor. Personalized approach.',
          headline: 'Mathematics mentor',
          rateCents: 25000,
          currency: 'UAH',
          languages: ['uk', 'ru'],
          subjects: ['math'],
        },
      },
    },
  })

  const student = await prisma.user.upsert({
    where: { email: 'student@example.com' },
    update: {},
    create: {
      email: 'student@example.com',
      name: 'Student',
      role: 'STUDENT',
      locale: 'uk',
    },
  })

  console.log('Seeded:', { olena: olena.id, dmytro: dmytro.id, student: student.id })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
}).finally(async () => {
  await prisma.$disconnect()
})
