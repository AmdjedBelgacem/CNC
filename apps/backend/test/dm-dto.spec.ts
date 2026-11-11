import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateConversationDto, DM_MAX_LENGTH, MarkReadDto, SendMessageDto } from '../src/modules/dm/dto/dm.dto';

const errorsFor = async <T extends object>(cls: new () => T, plain: object) =>
  (await validate(plainToInstance(cls, plain), { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property).sort();
const id = '11111111-1111-4111-8111-111111111111';

describe('direct message bodies are validated', () => {
  it('a conversation needs a real peer id', async () => {
    expect(await errorsFor(CreateConversationDto, { peerId: id })).toEqual([]);
    expect(await errorsFor(CreateConversationDto, { peerId: 'nope' })).toEqual(['peerId']);
    expect(await errorsFor(CreateConversationDto, {})).toEqual(['peerId']);
  });

  it('a message needs a conversation and a body within the limit', async () => {
    expect(await errorsFor(SendMessageDto, { conversationId: id, body: 'hi' })).toEqual([]);
    expect(await errorsFor(SendMessageDto, { conversationId: id, body: '' })).toEqual(['body']);
    expect(await errorsFor(SendMessageDto, { conversationId: id, body: 'x'.repeat(DM_MAX_LENGTH + 1) })).toEqual(['body']);
    expect(await errorsFor(SendMessageDto, { body: 'hi' })).toEqual(['conversationId']);
  });

  it('mark-read needs both ids', async () => {
    expect(await errorsFor(MarkReadDto, { conversationId: id, messageId: id })).toEqual([]);
    expect(await errorsFor(MarkReadDto, {})).toEqual(['conversationId', 'messageId']);
  });
});
