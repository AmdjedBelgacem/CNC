import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../schema';

export async function seedPosts(db: PostgresJsDatabase<typeof schema>, userId: string, tenantId: string) {
  await db.insert(schema.posts).values([
    {
      userId, tenantId,
      content: 'Just completed the CNC Milling Fundamentals course! The hands-on projects were incredible. Highly recommend to anyone starting out.',
      tags: ['course', 'cnc-milling'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Check out this 5-axis machining setup we did today. The surface finish was within 0.0002"! Absolutely incredible what modern machines can do.',
      tags: ['5-axis', 'machining'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'New TITAN TV video: Tormach 1100M full build timelapse. Link in bio! Go check it out.',
      tags: ['titan-tv', 'machine-build'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Does anyone have recommendations for workholding solutions for thin-wall aluminum parts? I\'m getting too much vibration on my current setup.',
      tags: ['workholding', 'aluminum'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Finally dialed in my feeds and speeds for Inconel 718. Secret? Lower SFM, higher feed rate, and lots of coolant. Tool life went from 8 minutes to 45!',
      tags: ['feeds-speeds', 'inconel', 'tool-life'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Shop upgrade day! New Renishaw probe installed on the Haas. Part setup time just dropped from 20 minutes to 3. Game changer.',
      tags: ['probe', 'haas', 'upgrade'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Pro tip: When face milling aluminum, try a 45° lead angle with ceramic inserts at 3000 SFM. The finish ismirror-like and cycle time drops 40%.',
      tags: ['tips', 'aluminum', 'face-milling'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Our study group met up this weekend. We built a full fixture plate from scratch — locating holes, T-slots, and dowel pins. Great learning experience!',
      tags: ['study-group', 'fixture', 'community'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Anyone else attending the TITANS CNC Workshop in Austin this June? Would love to meet up with other community members there!',
      tags: ['event', 'austin', 'networking'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Just published my first article on coolant through spindle vs flood coolant. TL;DR: through-spindle wins for deep pocketing, flood is fine for surface work.',
      tags: ['coolant', 'article', 'tips'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Morning shop view 🏭 Nothing beats the sound of a well-tuned CNC making chips. Happy Monday everyone!',
      tags: ['shop-life', 'monday', 'chips'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Question for the community: What\'s your preferred CAM software for 5-axis work? I\'m evaluating Fusion 360 vs Mastercam vs Hypermill. Would love to hear experiences.',
      tags: ['cam', '5-axis', 'software'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Machined a perfect impeller on the 5-axis today. 16 hours of machining, 0.0003" tolerance across all blades. This is why I love this trade.',
      tags: ['5-axis', 'impeller', 'precision'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'Safety reminder: Always wear proper PPE. I saw someone today without safety glasses near a running mill. Eyes don\'t grow back, folks. #ShopSafety',
      tags: ['safety', 'ppe', 'reminder'], isPublic: true,
    },
    {
      userId, tenantId,
      content: 'New blog post: "5 Mistakes Every Beginner Makes in CNC Milling" — written from all the mistakes I made so you don\'t have to. Link in profile.',
      tags: ['beginner', 'blog', 'tips'], isPublic: true,
    },
  ]);
  console.log('Seeded 15 posts');
}
