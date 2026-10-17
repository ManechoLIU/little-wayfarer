// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Personal journey records, not proof of real-world conduct or identity.
contract Wayfarer {
    struct Traveler { address origin; string name; uint32 seed; uint32 chapter; uint8 palette; uint8 trait; uint8 mood; uint16 marks; uint256 wornSouvenirId; uint32 souvenirCount; uint64 lastInteractionAt; uint8 lastInteraction; }
    struct Souvenir { uint256 source; uint256 target; uint32 chapter; uint8 markBit; address sender; uint64 timestamp; }
    uint256 public travelerCount;
    uint256 public souvenirCount;
    mapping(uint256 => uint256[4]) private giftTotals;
    function interactionVersion() external pure returns(uint8){return 2;}
    function getGiftCounts(uint256 id) external view returns(uint256[4] memory){if(travelers[id].origin==address(0))revert InvalidInput();return giftTotals[id];}
    mapping(uint256 => Traveler) private travelers;
    mapping(uint256 => mapping(address => bool)) public hasEncouraged;
    mapping(uint256 => mapping(uint8 => uint32)) public firstMarkChapter;
    mapping(uint256 => Souvenir) public souvenirs;
    mapping(uint256 => mapping(uint32 => uint256)) public receivedSouvenirs;
    mapping(uint256 => mapping(address => bool)) public hasSentSouvenir;
    event Born(uint256 indexed id,address indexed origin,string name,uint32 seed,uint8 palette,uint8 trait);
    event Chapter(uint256 indexed id,uint32 indexed chapter,uint8 eventId,uint8 responseId,uint8 mood,uint16 marks);
    event Encouraged(uint256 indexed id,address indexed companion,uint8 gift);
    event SouvenirSent(uint256 indexed id,uint256 indexed source,uint256 indexed target,address sender,uint8 markBit,uint32 chapter);
    event SouvenirWorn(uint256 indexed target,uint256 indexed giftId);
    error InvalidInput(); error NotOrigin(); error StaleChapter(); error AlreadyEncouraged();
    function create(string calldata name,uint32 seed,uint8 palette,uint8 trait) external returns(uint256 id){
        if(bytes(name).length==0 || bytes(name).length>48 || palette>3 || trait>3) revert InvalidInput();
        id=++travelerCount;travelers[id]=Traveler(msg.sender,name,seed,0,palette,trait,0,0,0,0,0,0);
        emit Born(id,msg.sender,name,seed,palette,trait);
    }
    function experience(uint256 id,uint32 expectedChapter,uint8 eventId,uint8 responseId) external { _experience(id,expectedChapter,eventId,responseId); }
    function experienceBatch(uint256 id,uint32 expectedChapter,uint8[] calldata events_,uint8[] calldata responses_) external {
        if(events_.length==0||events_.length>20||events_.length!=responses_.length)revert InvalidInput();
        for(uint256 i;i<events_.length;i++)_experience(id,expectedChapter+uint32(i),events_[i],responses_[i]);
    }
    function _experience(uint256 id,uint32 expectedChapter,uint8 eventId,uint8 responseId) private {
        Traveler storage t=travelers[id];if(t.origin!=msg.sender)revert NotOrigin();
        if(t.chapter!=expectedChapter)revert StaleChapter();
        (uint8 mood,uint16 mark)=outcome(eventId,responseId);t.chapter++;t.mood=mood;
        for(uint8 bit=0;bit<=10;bit++){
            uint16 flag=uint16(1)<<bit;
            if((mark&flag)!=0 && firstMarkChapter[id][bit]==0)firstMarkChapter[id][bit]=t.chapter;
        }
        t.marks|=mark;
        emit Chapter(id,t.chapter,eventId,responseId,mood,t.marks);
    }
    function encourage(uint256 id,uint8 gift) external {
        Traveler storage t=travelers[id];if(t.origin==address(0)||gift>3||t.origin==msg.sender)revert InvalidInput();
        hasEncouraged[id][msg.sender]=true;
        giftTotals[id][gift]++;
        if(gift==3){t.lastInteractionAt=uint64(block.timestamp);t.lastInteraction=gift;emit Encouraged(id,msg.sender,gift);return;}
        t.marks|=uint16(1<<(12+gift));t.mood=4;
        emit Encouraged(id,msg.sender,gift);
    }
    function getTraveler(uint256 id) external view returns(Traveler memory){if(travelers[id].origin==address(0))revert InvalidInput();return travelers[id];}
    function sendSouvenir(uint256 source,uint256 target,uint8 markBit) external returns(uint256 id){
        Traveler storage src=travelers[source];
        Traveler storage dst=travelers[target];
        if(src.origin!=msg.sender||dst.origin==address(0)||dst.origin==msg.sender||markBit>10||firstMarkChapter[source][markBit]==0)revert InvalidInput();
        id=++souvenirCount;
        souvenirs[id]=Souvenir(source,target,firstMarkChapter[source][markBit],markBit,msg.sender,uint64(block.timestamp));
        receivedSouvenirs[target][dst.souvenirCount]=id;
        dst.souvenirCount++;
        hasSentSouvenir[target][msg.sender]=true;
        emit SouvenirSent(id,source,target,msg.sender,markBit,souvenirs[id].chapter);
    }
    function wearSouvenir(uint256 target,uint256 giftId) external {
        Traveler storage t=travelers[target];
        if(t.origin!=msg.sender)revert NotOrigin();
        if(giftId!=0&&souvenirs[giftId].target!=target)revert InvalidInput();
        t.wornSouvenirId=giftId;
        emit SouvenirWorn(target,giftId);
    }
    /// @notice event IDs 0 exploration, 1 setback, 2 lonely, 3 mistake, 4 help, 5 rest.
    function outcome(uint8 eventId,uint8 responseId) public pure returns(uint8 mood,uint16 mark){
        if(eventId>5||responseId>1)revert InvalidInput();
        if(eventId==0)return responseId==0?(uint8(5),uint16(1)):(uint8(0),uint16(2));
        if(eventId==1)return responseId==0?(uint8(3),uint16(4)):(uint8(5),uint16(8));
        if(eventId==2)return responseId==0?(uint8(4),uint16(16)):(uint8(2),uint16(32));
        if(eventId==3)return responseId==0?(uint8(4),uint16(64)):(uint8(1),uint16(128));
        if(eventId==4)return responseId==0?(uint8(4),uint16(256)):(uint8(5),uint16(512));
        return responseId==0?(uint8(3),uint16(0)):(uint8(4),uint16(1024));
    }
}
